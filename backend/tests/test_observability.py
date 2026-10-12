"""Tests for the admin "AI" console backend (AI v2, Phase 1b):
app/services/observability.py (the aggregation), app/services/opik_api.py (the
Opik read client) and app/api/routers/observability.py (the admin routes).

Opik itself is never contacted: the client is exercised through an httpx
MockTransport and the routes through monkeypatched client functions. The shapes
used mirror Opik's TracePublic / SpanPublic schemas.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services import observability, opik_api
from main import app

client = TestClient(app)
run = asyncio.run
_RealAsyncClient = httpx.AsyncClient

NOW = datetime(2026, 10, 13, 12, 30, tzinfo=timezone.utc)


def trace(
    name="chat",
    *,
    tags=("chat",),
    minutes_ago=10,
    duration=None,
    ttft=None,
    tokens=None,
    cost=None,
    rating=None,
    guard=None,
    error=False,
    inp=None,
    out=None,
    metadata=None,
):
    t = {
        "id": str(uuid.uuid4()),
        "name": name,
        "start_time": (NOW - timedelta(minutes=minutes_ago)).isoformat().replace("+00:00", "Z"),
        "tags": list(tags),
        "input": inp,
        "output": out,
        "metadata": metadata,
    }
    if duration is not None:
        t["duration"] = duration
    if ttft is not None:
        t["ttft"] = ttft
    if tokens is not None:
        t["usage"] = {"prompt_tokens": tokens - 10, "completion_tokens": 10, "total_tokens": tokens}
    if cost is not None:
        t["total_estimated_cost"] = cost
    scores = []
    if rating is not None:
        scores.append({"name": observability.RATING_NAME, "value": rating})
    if guard is not None:
        scores.append({"name": observability.GUARD_NAME, "value": guard})
    if scores:
        t["feedback_scores"] = scores
    if error:
        t["error_info"] = {"exception_type": "HTTPException", "message": "boom", "traceback": "..."}
    return t


# --- aggregation -------------------------------------------------------------------------


def test_percentile_is_nearest_rank():
    assert observability.percentile([10, 20, 30, 40, 50], 50) == 30
    assert observability.percentile([10, 20, 30, 40, 50], 90) == 50
    assert observability.percentile([7], 99) == 7
    assert observability.percentile([], 50) is None


def test_aggregate_counts_rates_and_latency():
    traces = [
        trace(duration=1000, ttft=300, tokens=400, cost=0.002, rating=1),
        trace(duration=2000, ttft=500, tokens=600, tags=("chat", "fallback", "voice")),
        trace(duration=3000, ttft=700, tokens=800, tags=("chat", "navigate", "rag_fallback"), rating=0),
        trace(duration=50, tags=("chat", "blocked")),  # a guard block: no tokens, no ttft
        trace(duration=9000, tags=("chat", "error"), error=True),
        trace("admin.generate_description", tags=("admin",), duration=4000, tokens=100, cost=0.001),
        trace("admin.reindex", tags=("admin",), duration=500),
    ]
    a = observability.aggregate(traces)
    assert a["traces"] == 7 and a["chats"] == 5 and a["admin_calls"] == 2
    assert a["errors"] == 1 and a["blocked"] == 1 and a["navigate"] == 1 and a["rag_fallback"] == 1
    assert a["blocked_rate"] == pytest.approx(1 / 5)
    assert a["fallback_rate"] == pytest.approx(1 / 4)  # of chats that reached the model
    assert a["voice_share"] == pytest.approx(1 / 5)
    # chat latency only (admin calls are a different workload), nearest rank over 5 values
    assert a["latency_p50_ms"] == 2000 and a["latency_p90_ms"] == 9000
    assert a["ttft_avg_ms"] == pytest.approx(500)
    assert a["tokens_total"] == 400 + 600 + 800 + 100
    assert a["tokens_avg_per_chat"] == pytest.approx(600)  # only chats that used tokens
    assert a["cost_usd"] == pytest.approx(0.003)
    assert a["rating_avg"] == pytest.approx(0.5) and a["ratings_up"] == 1 and a["ratings_down"] == 1


def test_aggregate_of_nothing_is_safe():
    a = observability.aggregate([])
    assert a["traces"] == 0 and a["chats"] == 0
    for key in ("blocked_rate", "fallback_rate", "voice_share", "latency_p50_ms", "ttft_avg_ms", "rating_avg"):
        assert a[key] is None


def test_aggregate_tolerates_odd_traces():
    weird = [
        {},
        {"tags": None, "usage": "nope", "duration": "fast", "feedback_scores": [None, {"name": "x"}]},
        {"name": "chat", "tags": [1, None, "chat"], "usage": {"total_tokens": True}},
    ]
    a = observability.aggregate(weird)
    assert a["traces"] == 3 and a["chats"] == 1


def test_summary_pairs_current_with_previous_and_names_the_workloads():
    window = observability.Window(
        "7d", NOW - timedelta(days=7), NOW,
        current=[trace(), trace(), trace("admin.reindex", tags=("admin",))],
        previous=[trace()],
        truncated=True,
    )
    s = observability.build_summary(window)
    assert s["chats"] == {"value": 2.0, "previous": 1.0}
    assert s["sample_size"] == 3 and s["truncated"] is True
    assert s["by_name"] == {"chat": 2, "admin.reindex": 1}


def test_timeseries_fills_empty_buckets_and_places_traces():
    window = observability.Window(
        "24h", NOW - timedelta(hours=24), NOW,
        current=[
            trace(minutes_ago=5, duration=1000, tokens=200),
            trace(minutes_ago=20, duration=3000, tags=("chat", "blocked")),
            trace(minutes_ago=60 * 5, duration=500),
        ],
        previous=[], truncated=False,
    )
    ts = observability.build_timeseries(window)
    assert ts["interval"] == "hour" and len(ts["points"]) in (24, 25)
    by_time = {p["time"]: p for p in ts["points"]}
    latest = by_time["2026-10-13T12:00:00Z"]  # NOW is 12:30; 5 and 20 minutes ago both fall in the 12:00 hour
    assert latest["traces"] == 2 and latest["chats"] == 2 and latest["blocked"] == 1 and latest["tokens"] == 200
    assert latest["latency_p50_ms"] == 1000
    assert by_time["2026-10-13T07:00:00Z"]["traces"] == 1
    assert sum(p["traces"] for p in ts["points"]) == 3
    empty = by_time["2026-10-13T10:00:00Z"]
    assert empty["traces"] == 0 and empty["latency_p50_ms"] is None


def test_timeseries_is_daily_for_week_and_month_ranges():
    window = observability.Window(
        "7d", NOW - timedelta(days=7), NOW, current=[trace(minutes_ago=60 * 24 * 3)], previous=[], truncated=False
    )
    ts = observability.build_timeseries(window)
    assert ts["interval"] == "day" and len(ts["points"]) in (7, 8)
    assert all(p["time"].endswith("T00:00:00Z") for p in ts["points"])
    assert sum(p["traces"] for p in ts["points"]) == 1


def test_trace_rows_are_previewed_and_normalised():
    row = observability.trace_row(
        trace(
            inp={"message": "show me   your\nreact projects"},
            out={"content": None, "reply": "Here you go!"},
            metadata={"provider": "gemini", "model": "gemini-3.5-flash-lite", "path": "rag"},
            tags=("chat", "navigate"), duration=1234.5, ttft=321, tokens=500, rating=1,
        )
    )
    assert row["input_preview"] == "show me your react projects"
    assert row["output_preview"] == "Here you go!"
    assert (row["provider"], row["model"], row["path"]) == ("gemini", "gemini-3.5-flash-lite", "rag")
    assert row["tags"] == ["chat", "navigate"] and row["tokens"] == 500 and row["rating"] == 1.0
    assert row["error"] is False

    failed = observability.trace_row(trace(error=True, inp="x" * 500))
    assert failed["error"] is True and failed["error_message"] == "boom"
    assert len(failed["input_preview"]) == 160 and failed["input_preview"].endswith("…")


def test_admin_traces_get_a_readable_one_line_summary():
    p = observability.preview
    assert p({"entityType": "project", "data": {"title": "ViralAutomator", "tags": ["n8n"]}}) == "project: ViralAutomator"
    assert p({"title": "Issue 01", "projects": 2}) == "Issue 01"
    assert p({"project_ids": None, "theme_hint": "neon noir"}) == "theme: neon noir"
    assert p({"project_ids": None, "theme_hint": None}) == "(defaults)"
    assert p({"force": False}) == "force=false"
    assert p({"total": 40, "embedded": 2, "deleted": 1}) == "total=40, embedded=2, deleted=1"
    assert p({"project_ids": ["a", "b"], "theme_hint": ""}) == "project_ids=2 items"
    assert p({"blocked": True, "label": "injection", "reply": "I can only help with the portfolio."}) == (
        "I can only help with the portfolio."
    )
    assert p({"nested": {"a": 1}}) == '{"nested": {"a": 1}}'
    assert p(None) is None


def test_trace_detail_orders_spans_and_computes_offsets():
    t = trace(duration=1500, tokens=300)
    spans = [
        {"id": "b", "name": "llm", "type": "llm", "start_time": "2026-10-13T12:20:00.500000Z",
         "end_time": "2026-10-13T12:20:01.400000Z", "model": "m", "provider": "gemini",
         "usage": {"total_tokens": 300}, "ttft": 250.0, "output": "hi"},
        {"id": "a", "name": "embed_query", "type": "general", "start_time": "2026-10-13T12:20:00.000000Z",
         "end_time": "2026-10-13T12:20:00.200000Z", "duration": 200.0},
        {"id": "c", "name": "chat_guard", "type": "guardrail", "start_time": "2026-10-13T12:20:00.250000Z",
         "error_info": {"exception_type": "ValueError", "message": "bad"}},
    ]
    t["start_time"] = "2026-10-13T12:20:00.000000Z"
    detail = observability.trace_detail(t, spans)
    assert [s["name"] for s in detail["spans"]] == ["embed_query", "chat_guard", "llm"]
    llm = detail["spans"][2]
    assert llm["offset_ms"] == 500.0 and llm["duration_ms"] == 900.0 and llm["ttft_ms"] == 250.0
    assert detail["spans"][1]["error_message"] == "bad" and detail["spans"][1]["error_type"] == "ValueError"
    assert detail["spans"][0]["duration_ms"] == 200.0


# --- the Opik client -----------------------------------------------------------------------


@pytest.fixture
def opik(monkeypatch):
    """Opik configured and every HTTP call captured; `o.respond` answers."""
    o = type("O", (), {})()
    o.requests, o.respond = [], None
    monkeypatch.setattr(settings, "opik_api_key", "test-opik-key")
    monkeypatch.setattr(settings, "opik_workspace", "test-ws")
    monkeypatch.setattr(settings, "opik_url", "https://opik.test/api")
    monkeypatch.setattr(settings, "opik_project_name", "gg-portfolio")

    def handler(request: httpx.Request) -> httpx.Response:
        o.requests.append(request)
        return o.respond(request)

    def factory(*args, **kwargs):
        kwargs.pop("transport", None)
        return _RealAsyncClient(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)
    observability.clear_cache()
    return o


def test_list_traces_sends_auth_project_window_and_tag_filters(opik):
    opik.respond = lambda r: httpx.Response(200, json={"content": [], "total": 0})
    start, end = NOW - timedelta(days=7), NOW
    run(opik_api.list_traces(page=2, size=20, from_time=start, to_time=end, tags=["blocked", "chat"], search="react"))
    (request,) = opik.requests
    assert request.method == "GET" and request.url.path == "/api/v1/private/traces"
    assert request.headers["authorization"] == "test-opik-key"  # raw key, no Bearer
    assert request.headers["comet-workspace"] == "test-ws"
    q = request.url.params
    assert q["project_name"] == "gg-portfolio" and q["page"] == "2" and q["size"] == "20"
    assert q["from_time"] == "2026-10-06T12:30:00Z" and q["to_time"] == "2026-10-13T12:30:00Z"
    assert json.loads(q["filters"]) == [
        {"field": "tags", "operator": "contains", "value": "blocked"},
        {"field": "tags", "operator": "contains", "value": "chat"},
    ]
    assert q["search"] == "react" and q["truncate"] == "true"


def test_optional_params_are_left_out(opik):
    opik.respond = lambda r: httpx.Response(200, json={"content": [], "total": 0})
    run(opik_api.list_traces())
    q = opik.requests[0].url.params
    assert "filters" not in q and "search" not in q and "from_time" not in q


def test_fetch_traces_pages_until_everything_is_read(opik):
    def respond(request):
        page = int(request.url.params["page"])
        count = {1: 100, 2: 100, 3: 50}.get(page, 0)
        return httpx.Response(200, json={"total": 250, "content": [{"id": f"{page}-{i}"} for i in range(count)]})

    opik.respond = respond
    traces, truncated = run(opik_api.fetch_traces(NOW - timedelta(days=1), NOW))
    assert len(traces) == 250 and truncated is False and len(opik.requests) == 3


def test_fetch_traces_stops_at_the_cap_and_says_so(opik):
    opik.respond = lambda r: httpx.Response(
        200, json={"total": 9999, "content": [{"id": str(uuid.uuid4())} for _ in range(100)]}
    )
    traces, truncated = run(opik_api.fetch_traces(NOW - timedelta(days=1), NOW, cap=250))
    assert len(traces) == 250 and truncated is True
    assert len(opik.requests) == 3  # 100 + 100 + 100, cut to 250


def test_upstream_failures_carry_a_status_and_never_the_body(opik):
    opik.respond = lambda r: httpx.Response(401, json={"message": "secret-ish detail"})
    with pytest.raises(opik_api.OpikUpstreamError) as caught:
        run(opik_api.list_traces())
    assert caught.value.status_code == 401 and "secret-ish" not in str(caught.value)


def test_a_network_failure_is_an_upstream_error(opik):
    def boom(request):
        raise httpx.ConnectError("no route")

    opik.respond = boom
    with pytest.raises(opik_api.OpikUpstreamError) as caught:
        run(opik_api.list_traces())
    assert caught.value.status_code is None


def test_without_an_api_key_nothing_is_sent(opik, monkeypatch):
    monkeypatch.setattr(settings, "opik_api_key", "")
    with pytest.raises(opik_api.OpikNotConfiguredError):
        run(opik_api.list_traces())
    assert opik.requests == []


def test_feedback_is_a_put_to_the_traces_feedback_scores(opik):
    opik.respond = lambda r: httpx.Response(204)
    trace_id = uuid.uuid4()
    run(opik_api.add_feedback(trace_id, name="admin_rating", value=0.0, reason=None))
    run(opik_api.add_feedback(trace_id, name="guard_correct", value=1.0, reason="was fine"))
    first, second = opik.requests
    assert first.method == "PUT" and first.url.path == f"/api/v1/private/traces/{trace_id}/feedback-scores"
    assert json.loads(first.content) == {"name": "admin_rating", "value": 0.0, "source": "ui"}
    assert json.loads(second.content)["reason"] == "was fine"


# --- the admin routes -------------------------------------------------------------------------

ROUTES = [
    ("get", "/api/v1/ai/observability/status"),
    ("get", "/api/v1/ai/observability/summary"),
    ("get", "/api/v1/ai/observability/timeseries"),
    ("get", "/api/v1/ai/observability/traces"),
    ("get", f"/api/v1/ai/observability/traces/{uuid.uuid4()}"),
    ("post", f"/api/v1/ai/observability/traces/{uuid.uuid4()}/feedback"),
]


@pytest.fixture
def fresh(monkeypatch):
    observability.clear_cache()
    monkeypatch.setattr(settings, "opik_api_key", "test-opik-key")
    monkeypatch.setattr(settings, "opik_workspace", "test-ws")
    yield
    observability.clear_cache()


@pytest.mark.parametrize("method,path", ROUTES)
def test_every_route_requires_admin(method, path):
    r = getattr(client, method)(path, **({"json": {"score": 1}} if method == "post" else {}))
    assert r.status_code == 401


def test_status_reports_configuration_and_a_cloud_dashboard_link(admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "opik_api_key", "k")
    monkeypatch.setattr(settings, "opik_enabled", True)
    monkeypatch.setattr(settings, "opik_workspace", "pravin")
    monkeypatch.setattr(settings, "opik_url", "https://www.comet.com/opik/api")
    body = client.get("/api/v1/ai/observability/status", headers=admin_headers).json()
    assert body == {
        "configured": True, "tracing_enabled": True, "project": settings.opik_project_name,
        "workspace": "pravin", "dashboard_url": "https://www.comet.com/opik/pravin/projects",
    }
    monkeypatch.setattr(settings, "opik_api_key", "")
    monkeypatch.setattr(settings, "opik_url", "https://opik.internal/api")
    body = client.get("/api/v1/ai/observability/status", headers=admin_headers).json()
    assert body["configured"] is False and body["dashboard_url"] is None


@pytest.mark.parametrize("method,path", ROUTES[1:])
def test_data_routes_say_503_when_opik_is_not_configured(admin_headers, monkeypatch, method, path):
    observability.clear_cache()
    monkeypatch.setattr(settings, "opik_api_key", "")
    kwargs = {"json": {"score": 1}} if method == "post" else {}
    r = getattr(client, method)(path, headers=admin_headers, **kwargs)
    assert r.status_code == 503 and "not configured" in r.json()["detail"].lower()


def _stub_window(monkeypatch, current, previous=()):
    async def fake_fetch(start, end, *, cap=opik_api.MAX_TRACES):
        return (list(current) if (end - start) and end > datetime.now(timezone.utc) - timedelta(seconds=5) else list(previous)), False

    monkeypatch.setattr(opik_api, "fetch_traces", fake_fetch)


def test_summary_returns_metrics_with_previous_period(admin_headers, fresh, monkeypatch):
    now = datetime.now(timezone.utc)
    recent = lambda **kw: {**trace(**kw), "start_time": (now - timedelta(minutes=30)).isoformat()}  # noqa: E731
    _stub_window(monkeypatch, [recent(duration=1000, ttft=200, tokens=300), recent(tags=("chat", "blocked"), duration=40)], [recent(duration=800)])
    r = client.get("/api/v1/ai/observability/summary?range=7d", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["range"] == "7d" and body["sample_size"] == 2 and body["truncated"] is False
    assert body["chats"] == {"value": 2.0, "previous": 1.0}
    assert body["blocked_rate"]["value"] == pytest.approx(0.5)
    assert body["latency_p50_ms"]["value"] == 40 and body["tokens_total"]["value"] == 300


def test_timeseries_has_one_point_per_bucket(admin_headers, fresh, monkeypatch):
    now = datetime.now(timezone.utc)
    _stub_window(monkeypatch, [{**trace(duration=500), "start_time": (now - timedelta(minutes=10)).isoformat()}])
    body = client.get("/api/v1/ai/observability/timeseries?range=24h", headers=admin_headers).json()
    assert body["interval"] == "hour" and len(body["points"]) in (24, 25)
    assert sum(p["traces"] for p in body["points"]) == 1


def test_trace_list_filters_paginates_and_normalises(admin_headers, fresh, monkeypatch):
    seen = {}

    async def fake_list(**kwargs):
        seen.update(kwargs)
        return {"total": 41, "content": [trace(inp={"message": "hello"}, out="hi", duration=900)]}

    monkeypatch.setattr(opik_api, "list_traces", fake_list)
    r = client.get(
        "/api/v1/ai/observability/traces?range=30d&tag=blocked&search=%20react%20&page=2&size=10", headers=admin_headers
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["page"], body["size"], body["total"]) == (2, 10, 41)
    assert body["rows"][0]["input_preview"] == "hello" and body["rows"][0]["duration_ms"] == 900
    assert seen["tags"] == ["blocked"] and seen["search"] == "react" and seen["page"] == 2 and seen["size"] == 10
    assert seen["to_time"] - seen["from_time"] == timedelta(days=30)


@pytest.mark.parametrize(
    "query", ["tag=not-a-tag", "size=500", "page=0", "range=1y", "search=" + "x" * 101]
)
def test_trace_list_rejects_bad_parameters(admin_headers, fresh, query):
    assert client.get(f"/api/v1/ai/observability/traces?{query}", headers=admin_headers).status_code == 422


def test_trace_detail_includes_spans_and_maps_upstream_errors(admin_headers, fresh, monkeypatch):
    trace_id = uuid.uuid4()
    t = {**trace(duration=900), "id": str(trace_id), "start_time": "2026-10-13T12:00:00Z"}

    async def fake_trace(tid):
        return t

    async def fake_spans(tid):
        return [{"id": "s1", "name": "llm", "type": "llm", "start_time": "2026-10-13T12:00:00.400Z", "duration": 300}]

    monkeypatch.setattr(opik_api, "get_trace", fake_trace)
    monkeypatch.setattr(opik_api, "list_spans", fake_spans)
    body = client.get(f"/api/v1/ai/observability/traces/{trace_id}", headers=admin_headers).json()
    assert body["id"] == str(trace_id) and body["spans"][0]["offset_ms"] == 400.0

    async def missing(tid):
        raise opik_api.OpikUpstreamError(404, "gone")

    async def broken(tid):
        raise opik_api.OpikUpstreamError(500, "bad")

    monkeypatch.setattr(opik_api, "get_trace", missing)
    assert client.get(f"/api/v1/ai/observability/traces/{trace_id}", headers=admin_headers).status_code == 404
    monkeypatch.setattr(opik_api, "get_trace", broken)
    r = client.get(f"/api/v1/ai/observability/traces/{trace_id}", headers=admin_headers)
    assert r.status_code == 502 and "bad" not in r.text

    assert client.get("/api/v1/ai/observability/traces/not-a-uuid", headers=admin_headers).status_code == 422


def test_feedback_is_recorded_and_clears_the_cache(admin_headers, fresh, monkeypatch):
    recorded = []

    async def fake_feedback(trace_id, *, name, value, reason):
        recorded.append((str(trace_id), name, value, reason))

    monkeypatch.setattr(opik_api, "add_feedback", fake_feedback)
    observability._cache["7d"] = object()  # a stale summary
    trace_id = uuid.uuid4()
    r = client.post(
        f"/api/v1/ai/observability/traces/{trace_id}/feedback",
        json={"score": 0, "comment": "  wrong answer  "},
        headers=admin_headers,
    )
    assert r.status_code == 204
    assert recorded == [(str(trace_id), "admin_rating", 0.0, "wrong answer")]
    assert observability._cache == {}

    r = client.post(
        f"/api/v1/ai/observability/traces/{trace_id}/feedback",
        json={"name": "guard_correct", "score": 1},
        headers=admin_headers,
    )
    assert r.status_code == 204 and recorded[-1][1:3] == ("guard_correct", 1.0)


@pytest.mark.parametrize(
    "payload",
    [{"score": 2}, {"score": 0.5}, {"name": "something_else", "score": 1}, {"score": 1, "comment": "x" * 501}, {}],
)
def test_feedback_validates_its_input(admin_headers, fresh, payload):
    r = client.post(
        f"/api/v1/ai/observability/traces/{uuid.uuid4()}/feedback", json=payload, headers=admin_headers
    )
    assert r.status_code == 422
