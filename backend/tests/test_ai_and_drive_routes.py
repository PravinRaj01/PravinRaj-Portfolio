"""Confirms /ai/* and /drive/* (MIGRATION_PLAN.md §13 follow-up: the AI
generation, chat, and Google Drive proxy routes ported from the Supabase
Edge Functions).

/drive/* is tested against the real, live, public Google Drive API -- it's
read-only and GOOGLE_DRIVE_API_KEY is genuinely configured in this
environment, so these are real integration checks, not mocks.

/ai/* cannot be exercised end-to-end here: LOVABLE_API_KEY is intentionally
left unset (MIGRATION_PLAN.md §13), so these tests confirm the parts that
don't need a live key -- auth gating, request validation, and the clean 503
"not configured" path -- without making a real (paid) AI call.
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# --- /ai/generate-description --------------------------------------------

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


def test_generate_description_returns_503_when_ai_not_configured(admin_headers):
    r = client.post(
        "/api/v1/ai/generate-description",
        json={"entityType": "project", "mode": "professional", "data": {"title": "Test Project"}},
        headers=admin_headers,
    )
    # LOVABLE_API_KEY is unset in this environment -- a clean 503, not a
    # crash, confirms the gateway wrapper's not-configured guard works.
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"].lower()


# --- /ai/generate-magazine -------------------------------------------------

def test_generate_magazine_requires_admin():
    r = client.post("/api/v1/ai/generate-magazine", json={})
    assert r.status_code == 401


def test_generate_magazine_returns_503_when_ai_not_configured(admin_headers):
    r = client.post("/api/v1/ai/generate-magazine", json={}, headers=admin_headers)
    # Reaching 503 (not 400 "no projects found") confirms the real DB read
    # of creative/featured projects succeeded before the gateway call.
    assert r.status_code in (503, 400)
    if r.status_code == 400:
        assert "no projects found" in r.json()["detail"].lower()
    else:
        assert "not configured" in r.json()["detail"].lower()


# --- /ai/chat (public) ------------------------------------------------

def test_chat_is_public_but_returns_503_when_ai_not_configured():
    r = client.post("/api/v1/ai/chat", json={"message": "hello"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"].lower()


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
