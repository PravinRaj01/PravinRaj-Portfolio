"""Confirms the read-only content routers (§7) actually read from live Neon.

Deliberately not mocked: this hits the real database configured in
backend/.env, the same one the seed data (MIGRATION_PLAN.md §10) was loaded
into, so a green run here means "the endpoint reads real rows correctly,"
not just "the code path doesn't crash."

Run with: pytest tests/test_public_content_routes.py -v   (from backend/)
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# --- about ------------------------------------------------------------

def test_about_requires_mode():
    r = client.get("/api/v1/about")
    assert r.status_code == 422, "mode should be a required query param"


@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_about_returns_rows_for_mode(mode):
    r = client.get("/api/v1/about", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0, f"expected seeded about_content rows for mode={mode}"
    for row in rows:
        assert row["mode"] == mode
        assert isinstance(row["content"], str) and row["content"]
        assert "id" in row and "created_at" in row and "updated_at" in row


def test_about_rejects_invalid_mode():
    r = client.get("/api/v1/about", params={"mode": "bogus"})
    assert r.status_code == 422


# --- hero ---------------------------------------------------------------

@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_hero_returns_rows_for_mode(mode):
    r = client.get("/api/v1/hero", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0
    for row in rows:
        assert row["mode"] == mode
        assert row["name"] and row["title"] and row["greeting"] and row["cta_text"]


# --- skills ---------------------------------------------------------------

@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_skills_returns_rows_for_mode(mode):
    r = client.get("/api/v1/skills", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0
    for row in rows:
        assert row["mode"] == mode
        assert isinstance(row["skills"], list) and len(row["skills"]) > 0


def test_skills_ordered_by_order_index():
    r = client.get("/api/v1/skills", params={"mode": "professional"})
    rows = r.json()
    indices = [row["order_index"] for row in rows]
    assert indices == sorted(indices)


# --- services (no mode filter -- table has no mode column) ---------------

def test_services_returns_all_rows():
    r = client.get("/api/v1/services")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) == 6, "expected all 6 seeded services rows (no mode filter exists)"
    for row in rows:
        assert row["title"] and row["description"]
        assert isinstance(row["features"], list) and len(row["features"]) > 0


# --- projects ---------------------------------------------------------------

def test_projects_list_only_active():
    r = client.get("/api/v1/projects")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0
    assert all(row["is_active"] is True for row in rows), "inactive projects must not be public"


@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_projects_filtered_by_mode(mode):
    r = client.get("/api/v1/projects", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert all(row["mode"] == mode for row in rows)


def test_projects_nested_jsonb_shapes():
    r = client.get("/api/v1/projects")
    rows = r.json()
    row = next(r for r in rows if r["crop_square"] is not None)
    assert set(row["crop_square"].keys()) >= {"x", "y"}
    # project_links, when present, must match the ProjectLink schema
    linked = [r for r in rows if r["project_links"]]
    if linked:
        link = linked[0]["project_links"][0]
        assert {"label", "url", "show_on_card"} <= set(link.keys())


def test_project_by_slug_roundtrip():
    listing = client.get("/api/v1/projects").json()
    slugged = [p for p in listing if p["slug"]]
    assert slugged, "expected at least one seeded project with a slug"
    target = slugged[0]

    r = client.get(f"/api/v1/projects/by-slug/{target['slug']}")
    assert r.status_code == 200
    assert r.json()["id"] == target["id"]


def test_project_by_slug_404_for_unknown_slug():
    r = client.get("/api/v1/projects/by-slug/definitely-not-a-real-slug-xyz")
    assert r.status_code == 404
