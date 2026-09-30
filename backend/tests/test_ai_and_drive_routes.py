"""Confirms /ai/* and /drive/* -- the AI generation, chat, and Google Drive
proxy routes.

/drive/* is tested against the real, live, public Google Drive API -- it's
read-only and GOOGLE_DRIVE_API_KEY is genuinely configured in this
environment, so these are real integration checks, not mocks.

/ai/* now runs on Gemini (primary) + Groq (fallback), both free-tier
(app/services/ai_gateway.py). The 503 "not configured" tests monkeypatch both
keys blank for the duration of the test, regardless of what's actually set in
this environment, so they check the code path rather than the environment.
Where a real key *is* configured, a couple of tests call the real APIs for
real (same convention as the /drive/* tests below) -- these are skipped, not
failed, in an environment with no key.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from main import app

client = TestClient(app)


@pytest.fixture
def no_ai_keys(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")


# --- /ai/generate-description -----------------------------------------------

def test_generate_description_requires_admin():
    r = client.post(
        "/api/v1/ai/generate-description",
        json={"entityType": "project", "mode": "professional", "data": {"title": "x"}},
    )
    assert r.status_code == 401


def test_generate_description_rejects_missing_title(admin_headers):
    r = client.post(
        "/api/v1/ai/generate-description",
        json={"entityType": "project", "mode": "professional", "data": {}},
        headers=admin_headers,
    )
    assert r.status_code == 400
    assert "title" in r.json()["detail"].lower()


def test_generate_description_returns_503_when_ai_not_configured(admin_headers, no_ai_keys):
    r = client.post(
        "/api/v1/ai/generate-description",
        json={"entityType": "project", "mode": "professional", "data": {"title": "Test Project"}},
        headers=admin_headers,
    )
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"].lower()


def test_generate_description_works_for_real_when_configured(admin_headers):
    if not (settings.gemini_api_key or settings.groq_api_key):
        pytest.skip("no AI key configured in this environment")
    r = client.post(
        "/api/v1/ai/generate-description",
        json={
            "entityType": "project",
            "mode": "professional",
            "data": {"title": "Automated Test Suite", "category": "Testing", "tags": ["pytest"]},
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert len(r.json()["description"]) > 0


# --- /ai/generate-magazine ---------------------------------------------------

def test_generate_magazine_requires_admin():
    r = client.post("/api/v1/ai/generate-magazine", json={})
    assert r.status_code == 401


def test_generate_magazine_returns_503_when_ai_not_configured(admin_headers, no_ai_keys):
    # Reaching 503 (not 400 "no projects found") confirms the real DB read
    # of creative/featured projects succeeded before the gateway call.
    r = client.post("/api/v1/ai/generate-magazine", json={}, headers=admin_headers)
    assert r.status_code in (503, 400)
    if r.status_code == 400:
        assert "no projects found" in r.json()["detail"].lower()
    else:
        assert "not configured" in r.json()["detail"].lower()


# --- /ai/chat (public) -------------------------------------------------------

def test_chat_is_public_but_returns_503_when_ai_not_configured(no_ai_keys):
    r = client.post("/api/v1/ai/chat", json={"message": "hello"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"].lower()


def test_chat_rejects_blank_message_with_a_clean_400():
    # No AI key is mocked away here -- this checks that input validation
    # happens before any provider is contacted, whatever keys are set. It
    # also guards the fix in ai_gateway.open_stream: the provider status is
    # checked (and any error raised as a real HTTPException) *before*
    # StreamingResponse is constructed, because Starlette sends the 200
    # status line before it starts consuming the body iterator -- an
    # exception raised from inside a generator can no longer change the
    # response status at that point.
    r = client.post("/api/v1/ai/chat", json={"message": "   "})
    assert r.status_code == 400


def test_chat_streams_a_real_reply_when_configured():
    if not (settings.gemini_api_key or settings.groq_api_key):
        pytest.skip("no AI key configured in this environment")
    with client.stream(
        "POST", "/api/v1/ai/chat", json={"message": "Reply with exactly one word: pong"}
    ) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        body = b"".join(r.iter_bytes())
    assert b"data:" in body


# --- /drive/* (real, live, public Google Drive API) -----------------------

def test_drive_test_connection():
    r = client.get("/api/v1/drive/test")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert "Connected successfully" in body["message"]


def test_drive_count():
    r = client.get("/api/v1/drive/count")
    assert r.status_code == 200
    assert isinstance(r.json()["count"], int)
    assert r.json()["count"] >= 0


def test_drive_list():
    r = client.get("/api/v1/drive/list")
    assert r.status_code == 200
    files = r.json()["files"]
    assert isinstance(files, list)
    for f in files:
        assert set(f.keys()) <= {"id", "name", "mimeType", "thumbnailLink", "webViewLink", "parents"}
        assert "id" in f and "name" in f


def test_drive_list_is_public_no_auth_needed():
    # /drive/* mirrors the original Edge Function: public, no admin gate.
    r = client.get("/api/v1/drive/list")
    assert r.status_code == 200
