"""Unit tests for the chatbot RAG pieces (RAG_MIGRATION_PLAN.md). None of these
touch the database or the network: the search SQL and the live embedding API
were verified separately against real data. These cover the pure logic and,
most importantly, the wiring that decides RAG vs. the full-context fallback.
"""

import asyncio
import math
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.schemas.ai import ChatRequest
from app.services import ai_content, embeddings, rag_index


def run(coro):
    return asyncio.run(coro)


# --- embeddings --------------------------------------------------------------

def test_l2_normalize_returns_unit_vector():
    out = embeddings.l2_normalize([3.0, 4.0])
    assert out == pytest.approx([0.6, 0.8])
    assert math.sqrt(sum(v * v for v in out)) == pytest.approx(1.0)


def test_l2_normalize_leaves_zero_vector_alone():
    assert embeddings.l2_normalize([0.0, 0.0]) == [0.0, 0.0]


def test_to_pgvector_is_a_bracketed_comma_list():
    assert embeddings.to_pgvector([0.5, -1.0]) == "[0.50000000,-1.00000000]"


def test_embed_query_without_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(embeddings.EmbeddingUnavailableError):
        run(embeddings.embed_query("hello"))


def test_embed_documents_normalizes_each_vector(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")

    async def fake_post(client, path, payload):
        assert path == "batchEmbedContents"
        assert payload["requests"][0]["taskType"] == embeddings.TASK_DOCUMENT
        assert payload["requests"][0]["outputDimensionality"] == embeddings.EMBEDDING_DIMS
        return {"embeddings": [{"values": [3.0, 4.0]}, {"values": [0.0, 2.0]}]}

    monkeypatch.setattr(embeddings, "_post", fake_post)
    vectors = run(embeddings.embed_documents(["a", "b"]))
    assert vectors == [pytest.approx([0.6, 0.8]), pytest.approx([0.0, 1.0])]


def test_embed_documents_rejects_a_count_mismatch(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")

    async def fake_post(client, path, payload):
        return {"embeddings": [{"values": [1.0, 0.0]}]}  # 1 vector for 2 inputs

    monkeypatch.setattr(embeddings, "_post", fake_post)
    with pytest.raises(embeddings.EmbeddingUnavailableError):
        run(embeddings.embed_documents(["a", "b"]))


def test_embedding_error_is_a_rag_unavailable_error():
    # ai_content catches the base class so any "can't retrieve" falls back.
    assert issubclass(embeddings.EmbeddingUnavailableError, embeddings.RagUnavailableError)


# --- chunking ----------------------------------------------------------------

def _project(**overrides):
    base = dict(
        id="p1", title="ViralAutomator", description="Automates short clips.", category="Web",
        categories=["Web", "AI"], position=None, positions=["Developer"], tags=["Redis", "Docker"],
        project_date="Feb 2026", github_url="https://gh/x", live_url=None, project_links=[],
        featured=True, mode="professional",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_project_chunk_contains_the_searchable_facts():
    chunk = rag_index._project_chunk(_project())
    assert chunk.source_key == "project:p1"
    assert chunk.mode == "professional"
    assert chunk.title == "ViralAutomator"
    for fragment in ("[Featured]", "Redis, Docker", "Developer", "Feb 2026", "https://gh/x"):
        assert fragment in chunk.content


def test_project_without_description_is_skipped():
    assert rag_index._project_chunk(_project(description="   ")) is None


def test_project_links_are_included_and_malformed_ones_ignored():
    chunk = rag_index._project_chunk(
        _project(project_links=[{"label": "Demo", "url": "https://demo"}, {"label": "x"}, "junk"])
    )
    assert "Demo: https://demo" in chunk.content


def test_chunks_never_exceed_the_embedding_size_budget():
    chunk = rag_index._project_chunk(_project(description="word " * 5000))
    assert len(chunk.content) <= rag_index._MAX_CHUNK_CHARS


def test_experience_event_vs_job_labelled_differently():
    def exp(kind):
        return SimpleNamespace(
            id="e1", title="Canva Workshop", company="BINA", location="Online", period="2024",
            description="Taught Canva.", achievements=None, role="Speaker", experience_type=kind,
            mode="creative",
        )

    assert rag_index._experience_chunk(exp("event")).content.startswith("Event:")
    assert rag_index._experience_chunk(exp("job")).content.startswith("Work experience:")


def test_empty_skill_group_is_skipped():
    skill = SimpleNamespace(id="s1", category="Tools", skills=[], mode="professional")
    assert rag_index._skill_chunk(skill) is None


def test_about_title_is_labelled_not_a_bare_quote_author():
    about = SimpleNamespace(id="a1", section_title="Steve Jobs", content="Stay hungry.", mode="creative")
    assert rag_index._about_chunk(about).title == "About: Steve Jobs"


def test_hero_chunk_only_exists_for_fun_facts():
    hero = SimpleNamespace(id="h1", name="Pravin", title="Engineer", fun_facts=[], mode="professional")
    assert rag_index._hero_chunk(hero) is None
    hero.fun_facts = ["Likes tea"]
    assert "Likes tea" in rag_index._hero_chunk(hero).content


def test_digest_changes_when_mode_or_title_changes_not_only_content():
    base = rag_index.Chunk("k", "project", "professional", "T", "body")
    assert base.digest == rag_index.Chunk("k", "project", "professional", "T", "body").digest
    assert base.digest != rag_index.Chunk("k", "project", "creative", "T", "body").digest
    assert base.digest != rag_index.Chunk("k", "project", "professional", "T2", "body").digest
    assert base.digest != rag_index.Chunk("k", "project", "professional", "T", "body2").digest


# --- retrieval helpers -------------------------------------------------------

def test_long_message_is_used_as_is():
    msg = "what machine learning projects has he built so far in his career?"
    assert ai_content._retrieval_query(msg, [{"role": "user", "content": "earlier"}]) == msg


def test_short_followup_borrows_the_previous_user_turn():
    history = [
        {"role": "user", "content": "tell me about ViralAutomator"},
        {"role": "assistant", "content": "It automates clips."},
    ]
    out = ai_content._retrieval_query("tell me more", history)
    assert out.startswith("tell me about ViralAutomator")
    assert out.endswith("tell me more")


def test_short_message_without_history_is_unchanged():
    assert ai_content._retrieval_query("hello", []) == "hello"


def test_format_hits_lists_entries_under_their_titles():
    rows = [SimpleNamespace(title="Proj A", content="Does A."), SimpleNamespace(title="Proj B", content="Does B.")]
    out = ai_content._format_hits(rows)
    assert "### Proj A\nDoes A." in out and "### Proj B\nDoes B." in out
    assert "don't have that detail" in out  # the honesty instruction


def test_format_hits_with_no_rows_says_so():
    assert "No specific entries matched" in ai_content._format_hits([])


def test_system_prompt_intro_differs_but_button_contract_is_identical():
    full = ai_content._chat_system_prompt("Pravin", "CTX", "https://r/resume.pdf")
    rag = ai_content._chat_system_prompt("Pravin", "CTX", "https://r/resume.pdf", retrieved=True)
    assert "complete portfolio information" in full
    assert "complete portfolio information" not in rag
    for prompt in (full, rag):
        assert "[button:Download Resume](https://r/resume.pdf)" in prompt
    # everything from the guidelines onward must be byte-for-byte the same
    assert full[full.index("Guidelines:"):] == rag[rag.index("Guidelines:"):]


# --- RAG vs full-context wiring ---------------------------------------------

class FakeDB:
    def __init__(self):
        self.rolled_back = False

    async def rollback(self):
        self.rolled_back = True


def _patch_core(monkeypatch):
    async def fake_core(db, mode):
        return "CORE", SimpleNamespace(name="Pravin"), "https://r/resume.pdf"

    monkeypatch.setattr(ai_content, "_build_core_context", fake_core)


def test_try_rag_context_combines_core_and_hits(monkeypatch):
    _patch_core(monkeypatch)

    async def fake_retrieve(db, query, mode, vector=None):
        return [SimpleNamespace(title="Proj", content="Body", vec_rank=1, fts_rank=None)]

    monkeypatch.setattr(ai_content, "_retrieve", fake_retrieve)
    ctx, hero, resume = run(ai_content._try_rag_context(FakeDB(), "professional", "q"))
    assert ctx.startswith("CORE") and "### Proj\nBody" in ctx
    assert hero.name == "Pravin" and resume == "https://r/resume.pdf"


def test_try_rag_context_falls_back_when_retrieval_is_unavailable(monkeypatch):
    _patch_core(monkeypatch)

    async def boom(db, query, mode, vector=None):
        raise embeddings.RagUnavailableError("no embeddings")

    monkeypatch.setattr(ai_content, "_retrieve", boom)
    assert run(ai_content._try_rag_context(FakeDB(), "professional", "q")) is None


def test_try_rag_context_falls_back_and_rolls_back_on_a_db_error(monkeypatch):
    _patch_core(monkeypatch)

    async def boom(db, query, mode, vector=None):
        raise SQLAlchemyError("relation does not exist")

    monkeypatch.setattr(ai_content, "_retrieve", boom)
    db = FakeDB()
    assert run(ai_content._try_rag_context(db, "professional", "q")) is None
    assert db.rolled_back  # the transaction must be usable for the full-context fallback


def _capture_open_stream(monkeypatch):
    captured = {}

    async def fake_open_stream(messages, *, model_kind, fallback_messages=None):
        captured.update(messages=messages, fallback_messages=fallback_messages)
        return iter(())

    monkeypatch.setattr(ai_content.ai_gateway, "open_stream", fake_open_stream)
    return captured


def _stub_embedding(monkeypatch, vector=None):
    async def fake_embed(text_):
        return vector or [0.0] * embeddings.EMBEDDING_DIMS

    monkeypatch.setattr(ai_content.embeddings, "embed_query", fake_embed)


def _full_context(monkeypatch):
    async def fake_full(db, mode, *, compact=False):
        return ("COMPACT-FULL" if compact else "FULL"), SimpleNamespace(name="Pravin"), "https://r/resume.pdf"

    monkeypatch.setattr(ai_content, "_build_portfolio_context", fake_full)


def test_chat_uses_rag_when_enabled_and_available(monkeypatch):
    _stub_embedding(monkeypatch)
    monkeypatch.setattr(settings, "rag_enabled", True)
    monkeypatch.setattr(settings, "groq_api_key", "g")
    captured = _capture_open_stream(monkeypatch)
    _full_context(monkeypatch)

    async def fake_rag(db, mode, query, vector=None):
        return "RAG-CTX", SimpleNamespace(name="Pravin"), "https://r/resume.pdf"

    monkeypatch.setattr(ai_content, "_try_rag_context", fake_rag)
    run(ai_content.open_chat_stream(FakeDB(), ChatRequest(message="hi", contentMode="professional")))
    system = captured["messages"][0]["content"]
    assert "RAG-CTX" in system and "FULL" not in system
    # Groq gets the very same small prompt -- no separate compact variant.
    assert captured["fallback_messages"] is None


def test_chat_falls_back_to_full_context_when_rag_returns_none(monkeypatch):
    _stub_embedding(monkeypatch)
    monkeypatch.setattr(settings, "rag_enabled", True)
    monkeypatch.setattr(settings, "groq_api_key", "g")
    captured = _capture_open_stream(monkeypatch)
    _full_context(monkeypatch)

    async def fake_rag(db, mode, query, vector=None):
        return None

    monkeypatch.setattr(ai_content, "_try_rag_context", fake_rag)
    run(ai_content.open_chat_stream(FakeDB(), ChatRequest(message="hi", contentMode="professional")))
    assert "FULL" in captured["messages"][0]["content"]
    assert "COMPACT-FULL" in captured["fallback_messages"][0]["content"]


def test_chat_never_attempts_rag_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "rag_enabled", False)
    monkeypatch.setattr(settings, "groq_api_key", "")
    captured = _capture_open_stream(monkeypatch)
    _full_context(monkeypatch)

    async def must_not_run(db, mode, query, vector=None):
        raise AssertionError("RAG was attempted while disabled")

    monkeypatch.setattr(ai_content, "_try_rag_context", must_not_run)
    run(ai_content.open_chat_stream(FakeDB(), ChatRequest(message="hi", contentMode="professional")))
    assert "FULL" in captured["messages"][0]["content"]
    assert captured["fallback_messages"] is None
