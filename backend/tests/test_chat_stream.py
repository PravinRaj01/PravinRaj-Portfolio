"""Tests for chatbot navigation (app/services/chat_stream.py) and the streaming
tool-call support in app/services/ai_gateway.py.

No database and no real network. The stream fixtures reproduce the shapes
Gemini and Groq actually send when given a tool (captured live): both deliver a
complete tool call in a single chunk, Gemini with no `index` and a large opaque
`thought_signature`, Groq with `index: 0` after dozens of `reasoning` deltas,
and neither with any text alongside the call.
"""

import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest

from app.core.config import settings
from app.schemas.ai import ChatRequest
from app.services import ai_content, ai_gateway, chat_stream, embeddings
from app.services.ai_gateway import StreamObserver

run = asyncio.run
_RealAsyncClient = httpx.AsyncClient

CALL_ARGS = json.dumps(
    {"search": "React", "page": "projects", "announcement": "Here are Pravin's React projects!"}
)


def sse(*events, done=True) -> bytes:
    out = "".join(f"data: {json.dumps(e)}\n\n" for e in events)
    return (out + ("data: [DONE]\n\n" if done else "")).encode()


def gemini_tool_call_stream(arguments=CALL_ARGS) -> bytes:
    return sse(
        {
            "choices": [
                {
                    "delta": {
                        "role": "assistant",
                        "tool_calls": [
                            {
                                "extra_content": {"google": {"thought_signature": "OPAQUE-SIGNATURE-BLOB"}},
                                "function": {"arguments": arguments, "name": "navigate_to"},
                                "id": "call_1369454",
                                "type": "function",
                            }
                        ],
                    },
                    "index": 0,
                }
            ]
        },
        {
            "choices": [{"delta": {"role": "assistant"}, "finish_reason": "stop", "index": 0}],
            "usage": {"completion_tokens": 37, "prompt_tokens": 174, "total_tokens": 211},
        },
    )


def groq_tool_call_stream() -> bytes:
    reasoning = [{"choices": [{"index": 0, "delta": {"reasoning": w, "channel": "analysis"}}]} for w in ("User", " wants", " projects")]
    call = {
        "choices": [
            {
                "index": 0,
                "delta": {
                    "tool_calls": [
                        {"id": "fc_1", "type": "function", "index": 0,
                         "function": {"name": "navigate_to", "arguments": CALL_ARGS}}
                    ]
                },
            }
        ]
    }
    end = {
        "choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}],
        "usage": {"prompt_tokens": 200, "completion_tokens": 136, "total_tokens": 336,
                  "queue_time": 0.3, "completion_tokens_details": {"reasoning_tokens": 100}},
    }
    return sse(*reasoning, call, end)


def text_event(text):
    return {"choices": [{"delta": {"content": text}}]}


async def collect(stream):
    """Reads a navigation stream into decoded events; 'DONE' marks [DONE]."""
    raw = b""
    if hasattr(stream, "__aiter__"):
        async for chunk in stream:
            raw += chunk
    else:
        for chunk in stream:
            raw += chunk
    out = []
    for block in raw.decode().split("\n\n"):
        block = block.strip()
        if not block:
            continue
        assert block.startswith("data: "), block
        payload = block[6:]
        out.append("DONE" if payload == "[DONE]" else json.loads(payload))
    return raw, out


def contents(events):
    return [
        e["choices"][0]["delta"]["content"]
        for e in events
        if e != "DONE" and e.get("choices") and e["choices"][0].get("delta", {}).get("content")
    ]


def actions(events):
    return [e for e in events if e != "DONE" and e.get("type") == "action"]


async def never_resolves(page, search, mode, content_mode):
    raise AssertionError("slug lookup should not have run")


async def no_slug(page, search, mode, content_mode):
    return None


def upstream_of(*chunks):
    async def gen():
        for c in chunks:
            yield c

    return gen()


# --- argument validation --------------------------------------------------------


def test_a_valid_call_becomes_an_action():
    action = chat_stream.parse_navigate_call(CALL_ARGS)
    assert (action.page, action.search, action.mode) == ("projects", "React", None)
    assert action.announcement == "Here are Pravin's React projects!"


@pytest.mark.parametrize(
    "arguments",
    ['{"page": "admin"}', '{"page": ["projects"]}', '{"page": 7}', "not json", '"projects"', "[]", "{}", ""],
)
def test_calls_with_an_unknown_page_or_bad_json_are_rejected(arguments):
    assert chat_stream.parse_navigate_call(arguments) is None


def test_free_text_is_cleaned_capped_and_only_kept_where_it_means_something():
    messy = json.dumps({"page": "projects", "search": "re\nact\t" + "x" * 200, "announcement": "a\r\nb " + "y" * 400})
    action = chat_stream.parse_navigate_call(messy)
    assert action.search.startswith("re act xxx") and len(action.search) <= 60
    assert "\n" not in action.announcement and len(action.announcement) <= 160

    contact = chat_stream.parse_navigate_call('{"page":"contact","search":"react","mode":"nonsense"}')
    assert contact.search is None and contact.mode is None
    assert contact.announcement == "Taking you to the contact page."


def test_only_the_navigate_tool_is_acted_on():
    calls = [
        {"name": "delete_everything", "arguments": '{"page":"home"}'},
        {"name": "navigate_to", "arguments": '{"page":"academic","announcement":"Here."}'},
    ]
    assert chat_stream.first_navigate_action(calls).page == "academic"
    assert chat_stream.first_navigate_action(calls[:1]) is None


# --- reading tool calls out of a stream -------------------------------------------


def test_observer_reads_a_gemini_call_with_no_index():
    observer = StreamObserver(started=0.0)
    observer.feed(gemini_tool_call_stream())
    assert observer.tool_calls == [{"id": "call_1369454", "name": "navigate_to", "arguments": CALL_ARGS}]
    assert observer.usage == {"prompt_tokens": 174, "completion_tokens": 37, "total_tokens": 211}
    assert observer.done


def test_observer_reads_a_groq_call_after_reasoning_deltas():
    observer = StreamObserver(started=0.0)
    observer.feed(groq_tool_call_stream())
    (call,) = observer.tool_calls
    assert call["name"] == "navigate_to" and json.loads(call["arguments"])["page"] == "projects"
    assert observer.text == ""  # reasoning is not reply text
    assert observer.usage["total_tokens"] == 336


def test_observer_joins_arguments_streamed_in_fragments_across_chunks():
    pieces = ['{"page":', '"proj', 'ects","annou', 'ncement":"Hi"}']
    events = [
        {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "c1", "function": {"name": "navigate_to", "arguments": pieces[0]}}]}}]},
        *[
            {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": p}}]}}]}
            for p in pieces[1:]
        ],
    ]
    observer = StreamObserver(started=0.0)
    payload = sse(*events)
    for i in range(0, len(payload), 11):  # split mid-line
        observer.feed(payload[i : i + 11])
    (call,) = observer.tool_calls
    assert json.loads(call["arguments"]) == {"page": "projects", "announcement": "Hi"}


def test_observer_keeps_separate_calls_apart_and_continues_unindexed_fragments():
    events = [
        {"choices": [{"delta": {"tool_calls": [{"id": "a", "function": {"name": "navigate_to", "arguments": '{"page":"home",'}}]}}]},
        {"choices": [{"delta": {"tool_calls": [{"function": {"arguments": '"announcement":"x"}'}}]}}]},
        {"choices": [{"delta": {"tool_calls": [{"id": "b", "function": {"name": "other", "arguments": "{}"}}]}}]},
    ]
    observer = StreamObserver(started=0.0)
    observer.feed(sse(*events))
    assert [c["name"] for c in observer.tool_calls] == ["navigate_to", "other"]
    assert json.loads(observer.tool_calls[0]["arguments"])["announcement"] == "x"


# --- the stream re-emitter ----------------------------------------------------------


def test_a_tool_call_with_no_text_becomes_announcement_then_action_then_done():
    raw, events = run(
        collect(chat_stream.navigation_stream(upstream_of(gemini_tool_call_stream()), content_mode="professional", resolver=no_slug))
    )
    assert contents(events) == ["Here are Pravin's React projects!"]
    (action,) = actions(events)
    assert action == {
        "type": "action", "action": "navigate", "page": "projects", "mode": None,
        "search": "React", "slug": None, "announcement": "Here are Pravin's React projects!",
    }
    assert events[-1] == "DONE" and events.index(action) == len(events) - 2  # action sits right before [DONE]
    assert b"OPAQUE-SIGNATURE-BLOB" not in raw and b"tool_calls" not in raw  # provider internals never reach the browser


def test_the_groq_shape_works_the_same_way():
    raw, events = run(
        collect(chat_stream.navigation_stream(upstream_of(groq_tool_call_stream()), content_mode="both", resolver=no_slug))
    )
    assert actions(events)[0]["page"] == "projects"
    assert contents(events) == ["Here are Pravin's React projects!"]
    # The model's chain of thought stays on the server. (Token *counts* named
    # reasoning_tokens inside `usage` are harmless and do pass through.)
    assert b'"reasoning":' not in raw and b'"channel"' not in raw and b"wants" not in raw


def test_opaque_provider_fields_are_stripped_from_ordinary_text_events_too():
    body = sse(
        {"choices": [{"delta": {"role": "assistant", "content": "Hello", "extra_content": {"google": {"thought_signature": "BLOB"}}}}]},
        {"choices": [{"delta": {"extra_content": {"google": {"thought_signature": "BLOB2"}}}, "finish_reason": "stop"}],
         "usage": {"total_tokens": 9}},
    )
    raw, events = run(collect(chat_stream.navigation_stream(upstream_of(body), content_mode="both", resolver=never_resolves)))
    assert b"BLOB" not in raw
    assert contents(events) == ["Hello"]
    # the finish marker and the usage still reach the widget
    assert any(e != "DONE" and e["choices"] and e["choices"][0].get("finish_reason") == "stop" for e in events)
    assert any(e != "DONE" and e.get("usage") for e in events)


def test_text_that_comes_with_a_call_is_kept_and_not_duplicated():
    body = sse(text_event("Sure, "), text_event("here you go!"))[: -len(b"data: [DONE]\n\n")] + gemini_tool_call_stream()
    _, events = run(collect(chat_stream.navigation_stream(upstream_of(body), content_mode="both", resolver=no_slug)))
    assert contents(events) == ["Sure, ", "here you go!"]  # no announcement added
    assert len(actions(events)) == 1 and events[-1] == "DONE"


def test_an_ordinary_answer_passes_through_with_no_action():
    body = sse(text_event("Pravin builds "), text_event("AI tools."))
    raw, events = run(collect(chat_stream.navigation_stream(upstream_of(body), content_mode="both", resolver=never_resolves)))
    assert contents(events) == ["Pravin builds ", "AI tools."]
    assert actions(events) == [] and events[-1] == "DONE"


def test_a_call_to_an_unknown_page_is_dropped_but_the_reply_is_never_empty():
    bad = gemini_tool_call_stream('{"page":"admin","announcement":"Opening admin"}')
    _, events = run(collect(chat_stream.navigation_stream(upstream_of(bad), content_mode="both", resolver=never_resolves)))
    assert actions(events) == []
    assert contents(events) == [chat_stream._NOT_SURE]
    assert events[-1] == "DONE"


def test_an_invalid_call_after_real_text_adds_nothing():
    body = sse(text_event("Here is the answer."))[: -len(b"data: [DONE]\n\n")] + gemini_tool_call_stream("{broken")
    _, events = run(collect(chat_stream.navigation_stream(upstream_of(body), content_mode="both", resolver=no_slug)))
    assert contents(events) == ["Here is the answer."] and actions(events) == []


def test_an_exact_title_opens_that_item_directly():
    seen = []

    async def resolver(page, search, mode, content_mode):
        seen.append((page, search, mode, content_mode))
        return "viral-automator"

    args = json.dumps({"page": "projects", "search": "ViralAutomator", "announcement": "Opening it!"})
    _, events = run(
        collect(chat_stream.navigation_stream(upstream_of(gemini_tool_call_stream(args)), content_mode="professional", resolver=resolver))
    )
    (action,) = actions(events)
    assert action["slug"] == "viral-automator" and action["search"] is None  # opens the item, no list filter
    assert seen == [("projects", "ViralAutomator", None, "professional")]


def test_a_failed_or_unsafe_lookup_falls_back_to_the_filtered_list():
    async def exploding(page, search, mode, content_mode):
        raise RuntimeError("db down")

    async def unsafe(page, search, mode, content_mode):
        return "../../admin"

    for resolver in (exploding, unsafe):
        _, events = run(
            collect(chat_stream.navigation_stream(upstream_of(gemini_tool_call_stream()), content_mode="both", resolver=resolver))
        )
        (action,) = actions(events)
        assert action["slug"] is None and action["search"] == "React"


def test_pages_that_have_nothing_to_look_up_never_hit_the_database():
    args = '{"page":"contact","announcement":"Here is the contact page."}'
    _, events = run(
        collect(chat_stream.navigation_stream(upstream_of(gemini_tool_call_stream(args)), content_mode="both", resolver=never_resolves))
    )
    assert actions(events)[0]["page"] == "contact"


def test_a_plain_iterator_upstream_is_accepted_and_the_upstream_is_closed():
    closed = []

    async def upstream():
        try:
            yield text_event_bytes("hi")
        finally:
            closed.append(True)

    def text_event_bytes(t):
        return sse(text_event(t), done=False)

    _, events = run(collect(chat_stream.navigation_stream(upstream(), content_mode="both", resolver=no_slug)))
    assert contents(events) == ["hi"] and closed == [True]

    _, events = run(collect(chat_stream.navigation_stream(iter([sse(text_event("x"))]), content_mode="both", resolver=no_slug)))
    assert contents(events) == ["x"]


# --- slug lookup ---------------------------------------------------------------------


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _Session:
    def __init__(self, rows=None, error=None):
        self.rows, self.error, self.statements = rows or [], error, []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement):
        if self.error:
            raise self.error
        self.statements.append(str(statement))
        return _Result(self.rows)


def _use_session(monkeypatch, session):
    import app.db.session as db_session

    monkeypatch.setattr(db_session, "SessionLocal", lambda: session)


def test_lookup_returns_the_slug_only_for_a_single_clean_match(monkeypatch):
    session = _Session(rows=["viral-automator"])
    _use_session(monkeypatch, session)
    assert run(chat_stream.lookup_slug("projects", "ViralAutomator", None, "professional")) == "viral-automator"
    sql = session.statements[0]
    assert "lower(projects.title)" in sql and "projects.is_active" in sql and "projects.mode" in sql

    for rows in ([], ["a-one", "a-two"], [None], ["bad slug!"]):
        _use_session(monkeypatch, _Session(rows=rows))
        assert run(chat_stream.lookup_slug("projects", "X", None, "both")) is None


def test_lookup_for_experience_matches_title_or_company_and_survives_db_errors(monkeypatch):
    session = _Session(rows=["acme-engineer"])
    _use_session(monkeypatch, session)
    assert run(chat_stream.lookup_slug("experience", "Acme", "professional", "both")) == "acme-engineer"
    assert "lower(experiences.company)" in session.statements[0]

    _use_session(monkeypatch, _Session(error=RuntimeError("connection refused")))
    assert run(chat_stream.lookup_slug("experience", "Acme", None, "both")) is None


# --- gateway + full chat flow (mock HTTP) -----------------------------------------------


@pytest.fixture
def providers(monkeypatch):
    """Gemini only, all HTTP mocked by host. `p.bodies` holds each LLM request body."""
    p = SimpleNamespace(bodies=[], responder=None, opik=[], status_for_stream_options=None)
    monkeypatch.setattr(settings, "gemini_api_key", "gem-key")
    monkeypatch.setattr(settings, "groq_api_key", "")
    monkeypatch.setattr(settings, "rag_enabled", False)
    monkeypatch.setattr(settings, "chat_guard_enabled", False)
    monkeypatch.setattr(settings, "opik_enabled", False)
    monkeypatch.setattr(settings, "opik_api_key", "")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "opik.test":
            p.opik.append(json.loads(request.content))
            return httpx.Response(200)
        body = json.loads(request.content)
        p.bodies.append(body)
        return p.responder(body)

    def factory(*args, **kwargs):
        kwargs.pop("transport", None)
        return _RealAsyncClient(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)

    async def fake_full(db, mode, *, compact=False):
        return "FULL-CONTEXT", SimpleNamespace(name="Pravin"), None

    monkeypatch.setattr(ai_content, "_build_portfolio_context", fake_full)
    return p


def open_chat(message="show me your react projects"):
    async def go():
        stream = await ai_content.open_chat_stream(object(), ChatRequest(message=message, contentMode="professional"))
        return await collect(stream)

    return run(go())


def test_with_navigation_off_the_model_gets_no_tool_and_no_navigation_prompt(providers, monkeypatch):
    monkeypatch.setattr(settings, "chat_navigation_enabled", False)
    providers.responder = lambda body: httpx.Response(200, content=sse(text_event("Hi!")))
    raw, events = open_chat()
    (body,) = providers.bodies
    assert "tools" not in body and "tool_choice" not in body and "stream_options" not in body
    assert "navigate_to" not in body["messages"][0]["content"]
    assert contents(events) == ["Hi!"] and actions(events) == []


def test_with_navigation_on_a_tool_call_reaches_the_browser_as_an_action(providers, monkeypatch):
    monkeypatch.setattr(settings, "chat_navigation_enabled", True)
    monkeypatch.setattr(chat_stream, "lookup_slug", no_slug)  # keep the DB out of it
    providers.responder = lambda body: httpx.Response(200, content=gemini_tool_call_stream())
    raw, events = open_chat()

    (body,) = providers.bodies
    assert body["tool_choice"] == "auto"
    assert [t["function"]["name"] for t in body["tools"]] == ["navigate_to"]
    assert body["tools"][0]["function"]["parameters"]["properties"]["page"]["enum"] == list(chat_stream.PAGES)
    assert "navigate_to" in body["messages"][0]["content"]

    (action,) = actions(events)
    assert action["page"] == "projects" and action["search"] == "React"
    assert contents(events) == ["Here are Pravin's React projects!"]
    assert b"OPAQUE-SIGNATURE-BLOB" not in raw


def _enable_opik(monkeypatch):
    monkeypatch.setattr(settings, "opik_enabled", True)
    monkeypatch.setattr(settings, "opik_api_key", "k")
    monkeypatch.setattr(settings, "opik_workspace", "ws")
    monkeypatch.setattr(settings, "opik_url", "https://opik.test/api")


def test_tracing_asks_for_token_usage_and_records_the_tool_call(providers, monkeypatch):
    _enable_opik(monkeypatch)
    monkeypatch.setattr(settings, "chat_navigation_enabled", True)
    monkeypatch.setattr(chat_stream, "lookup_slug", no_slug)
    providers.responder = lambda body: httpx.Response(200, content=gemini_tool_call_stream())
    open_chat()

    assert providers.bodies[0]["stream_options"] == {"include_usage": True}
    traces = [t for batch in providers.opik if "traces" in batch for t in batch["traces"]]
    spans = [s for batch in providers.opik if "spans" in batch for s in batch["spans"]]
    (trace,) = traces
    assert {"chat", "navigate"} <= set(trace["tags"])
    assert trace["metadata"]["action_page"] == "projects"
    llm = next(s for s in spans if s["name"] == "llm")
    assert llm["usage"]["total_tokens"] == 211
    assert llm["output"]["tool_calls"][0]["name"] == "navigate_to"
    tool = next(s for s in spans if s["name"] == "navigate_to")
    assert tool["type"] == "tool" and tool["output"]["page"] == "projects"


def test_a_provider_rejecting_the_usage_option_is_retried_without_it(providers, monkeypatch):
    _enable_opik(monkeypatch)
    monkeypatch.setattr(settings, "chat_navigation_enabled", False)

    def responder(body):
        if "stream_options" in body:
            return httpx.Response(400, json={"error": {"message": "unknown field stream_options"}})
        return httpx.Response(200, content=sse(text_event("still works")))

    providers.responder = responder
    raw, events = open_chat()
    assert contents(events) == ["still works"]
    assert ["stream_options" in b for b in providers.bodies] == [True, False]
