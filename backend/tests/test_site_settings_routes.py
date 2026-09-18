"""Confirms the site-settings routers (§7) read the real singleton row from
live Neon: GET /site-settings and GET /site-settings/modes.
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MODE_FIELDS = {
    "professional_mode_enabled",
    "creative_mode_enabled",
    "default_mode",
    "professional_visible_pages",
    "creative_visible_pages",
}


def test_site_settings_full_row():
    r = client.get("/api/v1/site-settings")
    assert r.status_code == 200
    row = r.json()
    assert row["site_name"]
    assert "id" in row and "created_at" in row and "updated_at" in row
    # Full row must carry every field the /modes subset exposes, plus more.
    assert MODE_FIELDS <= set(row.keys())
    assert len(row.keys()) > len(MODE_FIELDS)


def test_site_settings_modes_subset():
    r = client.get("/api/v1/site-settings/modes")
    assert r.status_code == 200
    row = r.json()
    assert set(row.keys()) == MODE_FIELDS
    assert row["default_mode"] in ("professional", "creative", None)
    assert isinstance(row["professional_visible_pages"], (list, type(None)))
    assert isinstance(row["creative_visible_pages"], (list, type(None)))


def test_site_settings_modes_matches_full_row():
    full = client.get("/api/v1/site-settings").json()
    modes = client.get("/api/v1/site-settings/modes").json()
    for field in MODE_FIELDS:
        assert modes[field] == full[field]
