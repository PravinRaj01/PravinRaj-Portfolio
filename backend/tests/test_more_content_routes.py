"""Confirms the second batch of read-only content routers (§7) read from
live Neon: contact, stats, socials, github-ticker, education,
certifications, experiences, technical-skills.

Not mocked, same as tests/test_public_content_routes.py -- hits the real
database the seed data was loaded into.
"""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# --- contact (single row, 404 if none) --------------------------------

@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_contact_returns_row_for_mode(mode):
    r = client.get(f"/api/v1/contact/{mode}")
    assert r.status_code == 200
    row = r.json()
    assert row["mode"] == mode
    assert row["email"] and row["title"]


def test_contact_invalid_mode_422():
    r = client.get("/api/v1/contact/bogus")
    assert r.status_code == 422


# --- stats (mode required, ordered) ------------------------------------

def test_stats_requires_mode():
    r = client.get("/api/v1/stats")
    assert r.status_code == 422


@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_stats_returns_rows_for_mode(mode):
    r = client.get("/api/v1/stats", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert all(row["mode"] == mode for row in rows)
    indices = [row["order_index"] for row in rows]
    assert indices == sorted(indices)


# --- socials (mode optional, enabled_only toggle) -----------------------

def test_socials_no_params_returns_all():
    r = client.get("/api/v1/socials")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0


@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_socials_filtered_by_mode(mode):
    r = client.get("/api/v1/socials", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert all(row["mode"] == mode for row in rows)


def test_socials_enabled_only():
    all_rows = client.get("/api/v1/socials").json()
    enabled_rows = client.get("/api/v1/socials", params={"enabled_only": True}).json()
    assert len(enabled_rows) <= len(all_rows)
    assert all(row["enabled"] is True for row in enabled_rows)


# --- github-ticker (returns null, not 404, when absent) ------------------

@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_github_ticker_returns_row_for_seeded_mode(mode):
    r = client.get(f"/api/v1/github-ticker/{mode}")
    assert r.status_code == 200
    row = r.json()
    assert row is not None
    assert row["mode"] == mode
    assert row["text"] and row["url"]


def test_github_ticker_invalid_mode_422():
    r = client.get("/api/v1/github-ticker/bogus")
    assert r.status_code == 422


# --- education / certifications (no mode column) -------------------------

def test_education_returns_all_rows():
    r = client.get("/api/v1/education")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 3, "expected all 3 seeded education rows"
    for row in rows:
        assert row["degree"] and row["institution"]


def test_certifications_returns_all_rows():
    r = client.get("/api/v1/certifications")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 10, "expected all 10 seeded certifications rows"
    for row in rows:
        assert row["name"] and row["issuer"]


# --- experiences (mode optional, unordered) -------------------------------

def test_experiences_no_mode_returns_all():
    r = client.get("/api/v1/experiences")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 11, "expected all 11 seeded experiences rows"


@pytest.mark.parametrize("mode", ["professional", "creative"])
def test_experiences_filtered_by_mode(mode):
    r = client.get("/api/v1/experiences", params={"mode": mode})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert all(row["mode"] == mode for row in rows)


# --- technical-skills (no mode, is_active filter, ordered by name) -------

def test_technical_skills_all_active_and_sorted():
    r = client.get("/api/v1/technical-skills")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) > 0
    assert all(row["is_active"] is True for row in rows)
    names = [row["name"] for row in rows]
    assert names == sorted(names)
