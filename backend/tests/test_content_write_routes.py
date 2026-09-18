"""Confirms the new admin write endpoints for the 5 core public resources
(about, hero, skills, services, projects): require_admin gating, the
create->update->delete round trip, and (for projects specifically) the
slug auto-generation/dedupe logic and the admin-gated include_inactive flag.

These tables drive the real public site, so every test that creates a row
deletes it again in a finally block.
"""

import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# --- generic 401-without-token checks, one per resource -------------------

def test_about_create_requires_admin():
    r = client.post("/api/v1/about", json={"mode": "professional", "content": "x"})
    assert r.status_code == 401


def test_hero_create_requires_admin():
    r = client.post(
        "/api/v1/hero",
        json={"mode": "professional", "name": "x", "title": "x", "greeting": "x",
              "description": "x", "cta_text": "x"},
    )
    assert r.status_code == 401


def test_skills_create_requires_admin():
    r = client.post(
        "/api/v1/skills",
        json={"mode": "professional", "category": "x", "icon": "x", "color": "x", "skills": ["x"]},
    )
    assert r.status_code == 401


def test_services_create_requires_admin():
    r = client.post(
        "/api/v1/services", json={"title": "x", "description": "x", "features": ["x"]}
    )
    assert r.status_code == 401


def test_projects_create_requires_admin():
    r = client.post(
        "/api/v1/projects",
        json={"title": "x", "description": "x", "mode": "professional", "category": "x"},
    )
    assert r.status_code == 401


# --- full round trips -------------------------------------------------

def test_about_content_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/about",
        json={"mode": "professional", "content": "Pytest about content", "order_index": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/about/{row_id}", json={"content": "updated"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["content"] == "updated"
        assert r.json()["mode"] == "professional"  # unset fields untouched

        rows = client.get("/api/v1/about", params={"mode": "professional"}).json()
        assert any(row["id"] == row_id for row in rows)
    finally:
        r = client.delete(f"/api/v1/about/{row_id}", headers=admin_headers)
        assert r.status_code == 204

    rows = client.get("/api/v1/about", params={"mode": "professional"}).json()
    assert not any(row["id"] == row_id for row in rows)


def test_hero_content_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/hero",
        json={
            "mode": "creative", "name": "Pytest", "title": "x", "greeting": "hi",
            "description": "x", "cta_text": "x", "order_index": 999,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/hero/{row_id}", json={"title": "Updated Title"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "Updated Title"
        assert r.json()["name"] == "Pytest"
    finally:
        assert client.delete(f"/api/v1/hero/{row_id}", headers=admin_headers).status_code == 204


def test_skill_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/skills",
        json={"mode": "professional", "category": "PytestCat", "icon": "Beaker",
              "color": "red", "skills": ["A", "B"], "order_index": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/skills/{row_id}", json={"skills": ["A", "B", "C"]}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["skills"] == ["A", "B", "C"]
    finally:
        assert client.delete(f"/api/v1/skills/{row_id}", headers=admin_headers).status_code == 204


def test_service_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/services",
        json={"title": "PytestService", "description": "x", "features": ["a"], "order_index": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/services/{row_id}", json={"description": "updated"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["description"] == "updated"
        assert r.json()["title"] == "PytestService"
    finally:
        assert client.delete(f"/api/v1/services/{row_id}", headers=admin_headers).status_code == 204


# --- projects: slug generation, dedupe, custom slug, include_inactive ----

def test_project_slug_auto_generated(admin_headers):
    title = f"Pytest Project {uuid.uuid4().hex[:8]}!!!"
    r = client.post(
        "/api/v1/projects",
        json={"title": title, "description": "x", "mode": "professional", "category": "x"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    try:
        expected_slug = title.replace("!!!", "").strip().lower().replace(" ", "-")
        assert created["slug"] == expected_slug
    finally:
        client.delete(f"/api/v1/projects/{created['id']}", headers=admin_headers)


def test_project_slug_dedupe_on_conflict(admin_headers):
    title = f"Pytest Dup {uuid.uuid4().hex[:8]}"
    ids = []
    try:
        r1 = client.post(
            "/api/v1/projects",
            json={"title": title, "description": "x", "mode": "professional", "category": "x"},
            headers=admin_headers,
        )
        assert r1.status_code == 200
        ids.append(r1.json()["id"])

        r2 = client.post(
            "/api/v1/projects",
            json={"title": title, "description": "x", "mode": "professional", "category": "x"},
            headers=admin_headers,
        )
        assert r2.status_code == 200
        ids.append(r2.json()["id"])

        assert r1.json()["slug"] != r2.json()["slug"]
        assert r2.json()["slug"] == f"{r1.json()['slug']}-2"
    finally:
        for pid in ids:
            client.delete(f"/api/v1/projects/{pid}", headers=admin_headers)


def test_project_custom_slug_respected(admin_headers):
    r = client.post(
        "/api/v1/projects",
        json={
            "title": "Whatever Title", "description": "x", "mode": "professional",
            "category": "x", "slug": "my-custom-slug-pytest",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    try:
        assert created["slug"] == "my-custom-slug-pytest"
    finally:
        client.delete(f"/api/v1/projects/{created['id']}", headers=admin_headers)


def test_project_include_inactive_requires_admin(admin_headers):
    r = client.post(
        "/api/v1/projects",
        json={
            "title": "Pytest Inactive", "description": "x", "mode": "professional",
            "category": "x", "is_active": False,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    try:
        public_rows = client.get("/api/v1/projects").json()
        assert not any(row["id"] == created["id"] for row in public_rows)

        unauthed_with_flag = client.get("/api/v1/projects", params={"include_inactive": True}).json()
        assert not any(row["id"] == created["id"] for row in unauthed_with_flag)

        admin_rows = client.get(
            "/api/v1/projects", params={"include_inactive": True}, headers=admin_headers
        ).json()
        assert any(row["id"] == created["id"] for row in admin_rows)
    finally:
        client.delete(f"/api/v1/projects/{created['id']}", headers=admin_headers)


def test_project_update_delete(admin_headers):
    r = client.post(
        "/api/v1/projects",
        json={"title": "Pytest Update Me", "description": "x", "mode": "creative", "category": "x"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    project_id = r.json()["id"]
    try:
        r = client.patch(
            f"/api/v1/projects/{project_id}", json={"description": "new desc"}, headers=admin_headers
        )
        assert r.status_code == 200
        assert r.json()["description"] == "new desc"
        assert r.json()["title"] == "Pytest Update Me"
    finally:
        r = client.delete(f"/api/v1/projects/{project_id}", headers=admin_headers)
        assert r.status_code == 204
