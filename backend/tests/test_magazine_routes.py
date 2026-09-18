"""Confirms /magazine: the public latest-published lookup, admin-only
list/create/delete, and -- the actual point of this phase -- that
publish/unpublish is atomic: publishing issue B while issue A is already
published leaves exactly one published issue at every observable point,
never zero and never two.

The single real seeded issue is currently unpublished (is_published=False),
so /magazine/latest legitimately returns null at the start of this file;
every test that publishes something cleans up (deletes its own temp
issues) so that state is restored by the end.
"""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from main import app

client = TestClient(app)


def _content(title: str) -> dict:
    return {
        "title": title,
        "cover": {"headline": "Cover", "subhead": "Subhead"},
        "editors_note": {"title": "Note", "body": "Body"},
        "articles": [],
        "closing": {"title": "Closing", "body": "Bye"},
    }


async def _published_count() -> int:
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT count(*) FROM magazine_issues WHERE is_published = true"))
        return result.scalar_one()


def _create(title: str, admin_headers: dict) -> dict:
    r = client.post(
        "/api/v1/magazine",
        json={"title": title, "content": _content(title), "mode": "creative"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    return r.json()


def test_list_requires_admin():
    r = client.get("/api/v1/magazine")
    assert r.status_code == 401


def test_create_requires_admin():
    r = client.post("/api/v1/magazine", json={"title": "x", "content": _content("x")})
    assert r.status_code == 401


def test_create_list_delete_flow(admin_headers):
    issue = _create("PytestIssue", admin_headers)
    issue_id = issue["id"]
    assert issue["is_published"] is False
    assert issue["content"]["title"] == "PytestIssue"

    try:
        rows = client.get("/api/v1/magazine", headers=admin_headers).json()
        assert any(row["id"] == issue_id for row in rows)
    finally:
        r = client.delete(f"/api/v1/magazine/{issue_id}", headers=admin_headers)
        assert r.status_code == 204


def test_publish_unpublish_is_atomic(admin_headers):
    baseline_published = asyncio.run(_published_count())

    issue_a = _create("PytestAtomicA", admin_headers)
    issue_b = _create("PytestAtomicB", admin_headers)
    try:
        # Publish A.
        r = client.post(f"/api/v1/magazine/{issue_a['id']}/publish", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_published"] is True
        assert asyncio.run(_published_count()) == baseline_published + 1

        latest = client.get("/api/v1/magazine/latest").json()
        assert latest is not None
        assert latest["id"] == issue_a["id"]

        # Publish B -- must atomically unpublish A in the same operation,
        # never leaving both (or neither) published.
        r = client.post(f"/api/v1/magazine/{issue_b['id']}/publish", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_published"] is True
        assert asyncio.run(_published_count()) == baseline_published + 1, (
            "publish must be atomic: exactly one issue published, never two"
        )

        latest = client.get("/api/v1/magazine/latest").json()
        assert latest["id"] == issue_b["id"]

        # Confirm A really was flipped back by the same transaction.
        all_issues = client.get("/api/v1/magazine", headers=admin_headers).json()
        a_row = next(row for row in all_issues if row["id"] == issue_a["id"])
        assert a_row["is_published"] is False

        # Unpublish B.
        r = client.post(f"/api/v1/magazine/{issue_b['id']}/unpublish", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_published"] is False
        assert asyncio.run(_published_count()) == baseline_published

        # Neither A nor B should be the latest published issue any more
        # (whatever -- if anything -- was published at baseline still is).
        latest = client.get("/api/v1/magazine/latest").json()
        assert latest is None or latest["id"] not in (issue_a["id"], issue_b["id"])
    finally:
        client.delete(f"/api/v1/magazine/{issue_a['id']}", headers=admin_headers)
        client.delete(f"/api/v1/magazine/{issue_b['id']}", headers=admin_headers)

    assert asyncio.run(_published_count()) == baseline_published


def test_publish_requires_admin():
    r = client.post("/api/v1/magazine/00000000-0000-0000-0000-000000000000/publish")
    assert r.status_code == 401


def test_publish_missing_issue_404(admin_headers):
    r = client.post(
        "/api/v1/magazine/00000000-0000-0000-0000-000000000000/publish", headers=admin_headers
    )
    assert r.status_code == 404
