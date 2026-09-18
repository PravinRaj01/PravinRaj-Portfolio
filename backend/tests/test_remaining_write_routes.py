"""Confirms the final batch of admin write endpoints: contact (upsert),
stats, socials, github-ticker (patch-only), education, certifications,
experiences, technical-skills, site-settings (singleton upsert).

All of these drive real, live public content (or the site's own identity/
config, for site_settings), so every test that writes cleans up in a
finally block -- contact and site_settings specifically restore the
original row content, since both are singleton-per-key rows that can't
just be deleted.
"""

import asyncio
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from main import app

client = TestClient(app)


# --- contact_content: PUT upsert ------------------------------------------

def test_contact_upsert_requires_admin():
    r = client.put("/api/v1/contact/professional", json={"title": "x", "email": "x@example.com"})
    assert r.status_code == 401


def test_contact_upsert_round_trip(admin_headers):
    original = client.get("/api/v1/contact/professional").json()
    try:
        r = client.put(
            "/api/v1/contact/professional",
            json={"title": "Pytest Title", "email": "pytest@example.com", "phone": "123"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["mode"] == "professional"
        assert body["title"] == "Pytest Title"
        assert body["email"] == "pytest@example.com"

        fetched = client.get("/api/v1/contact/professional").json()
        assert fetched["title"] == "Pytest Title"
    finally:
        client.put(
            "/api/v1/contact/professional",
            json={
                "title": original["title"],
                "email": original["email"],
                "subtitle": original.get("subtitle"),
                "phone": original.get("phone"),
                "location": original.get("location"),
                "services": original.get("services"),
            },
            headers=admin_headers,
        )

    restored = client.get("/api/v1/contact/professional").json()
    assert restored["title"] == original["title"]
    assert restored["email"] == original["email"]


# --- stats ------------------------------------------------------------

def test_stat_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/stats",
        json={"mode": "professional", "label": "PytestLabel", "value": "1", "order_index": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/stats/{row_id}", json={"value": "2"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["value"] == "2"
    finally:
        assert client.delete(f"/api/v1/stats/{row_id}", headers=admin_headers).status_code == 204


def test_stat_create_requires_admin():
    r = client.post("/api/v1/stats", json={"mode": "professional", "label": "x", "value": "x"})
    assert r.status_code == 401


# --- socials ------------------------------------------------------------

def test_social_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/socials",
        json={"name": "PytestSocial", "icon": "link", "url": "https://example.com", "mode": "creative"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/socials/{row_id}", json={"enabled": False}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["enabled"] is False
    finally:
        assert client.delete(f"/api/v1/socials/{row_id}", headers=admin_headers).status_code == 204


def test_social_create_requires_admin():
    r = client.post("/api/v1/socials", json={"name": "x", "icon": "x", "url": "https://x.com"})
    assert r.status_code == 401


# --- github_ticker: PATCH only, no POST/DELETE ---------------------------

def test_github_ticker_update_round_trip(admin_headers):
    row = client.get("/api/v1/github-ticker/professional").json()
    original_text, original_url = row["text"], row["url"]
    try:
        r = client.patch(
            f"/api/v1/github-ticker/{row['id']}",
            json={"text": "Pytest ticker text"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["text"] == "Pytest ticker text"
        assert r.json()["url"] == original_url  # unset field untouched
    finally:
        client.patch(
            f"/api/v1/github-ticker/{row['id']}",
            json={"text": original_text, "url": original_url},
            headers=admin_headers,
        )

    restored = client.get("/api/v1/github-ticker/professional").json()
    assert restored["text"] == original_text


def test_github_ticker_update_requires_admin():
    r = client.patch(
        "/api/v1/github-ticker/00000000-0000-0000-0000-000000000000", json={"text": "x"}
    )
    assert r.status_code == 401


# --- education / certifications / experiences (generic CRUD) -------------

def test_education_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/education",
        json={"degree": "PytestDegree", "institution": "x", "location": "x", "period": "x", "description": "x"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/education/{row_id}", json={"institution": "Updated U"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["institution"] == "Updated U"
    finally:
        assert client.delete(f"/api/v1/education/{row_id}", headers=admin_headers).status_code == 204


def test_certification_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/certifications",
        json={"name": "PytestCert", "issuer": "x", "description": "x", "date": "2024"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/certifications/{row_id}", json={"featured": True}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["featured"] is True
    finally:
        assert client.delete(f"/api/v1/certifications/{row_id}", headers=admin_headers).status_code == 204


def test_experience_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/experiences",
        json={"title": "PytestRole", "company": "x", "location": "x", "period": "x",
              "description": "x", "mode": "professional"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(f"/api/v1/experiences/{row_id}", json={"company": "Updated Co"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["company"] == "Updated Co"
    finally:
        assert client.delete(f"/api/v1/experiences/{row_id}", headers=admin_headers).status_code == 204


def test_education_create_requires_admin():
    r = client.post("/api/v1/education", json={"degree": "x", "institution": "x", "location": "x", "period": "x", "description": "x"})
    assert r.status_code == 401


def test_certification_create_requires_admin():
    r = client.post("/api/v1/certifications", json={"name": "x", "issuer": "x", "description": "x", "date": "x"})
    assert r.status_code == 401


def test_experience_create_requires_admin():
    r = client.post("/api/v1/experiences", json={"title": "x", "company": "x", "location": "x", "period": "x", "description": "x", "mode": "professional"})
    assert r.status_code == 401


# --- technical_skills (new admin surface, no frontend hook yet) ----------

def test_technical_skill_crud_roundtrip(admin_headers):
    r = client.post(
        "/api/v1/technical-skills",
        json={"name": "PytestSkill", "category": "Testing", "is_active": True},
        headers=admin_headers,
    )
    assert r.status_code == 200
    row_id = r.json()["id"]
    try:
        r = client.patch(
            f"/api/v1/technical-skills/{row_id}", json={"category": "Updated"}, headers=admin_headers
        )
        assert r.status_code == 200
        assert r.json()["category"] == "Updated"
    finally:
        assert client.delete(f"/api/v1/technical-skills/{row_id}", headers=admin_headers).status_code == 204


def test_technical_skill_create_requires_admin():
    r = client.post("/api/v1/technical-skills", json={"name": "x", "category": "x"})
    assert r.status_code == 401


# --- site_settings: PUT singleton upsert ----------------------------------

def test_site_settings_upsert_requires_admin():
    r = client.put("/api/v1/site-settings", json={"chatbot_name": "x"})
    assert r.status_code == 401


def test_site_settings_upsert_round_trip(admin_headers):
    original = client.get("/api/v1/site-settings").json()
    try:
        r = client.put(
            "/api/v1/site-settings", json={"chatbot_name": "PytestBot"}, headers=admin_headers
        )
        assert r.status_code == 200
        assert r.json()["chatbot_name"] == "PytestBot"
        # Unrelated fields must survive an update that only sent one field.
        assert r.json()["site_name"] == original["site_name"]

        fetched = client.get("/api/v1/site-settings").json()
        assert fetched["chatbot_name"] == "PytestBot"
    finally:
        client.put(
            "/api/v1/site-settings",
            json={"chatbot_name": original["chatbot_name"]},
            headers=admin_headers,
        )

    restored = client.get("/api/v1/site-settings").json()
    assert restored["chatbot_name"] == original["chatbot_name"]
