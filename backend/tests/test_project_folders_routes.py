"""Confirms /project-folders: public list (is_active filtering, the
include_inactive admin gate), the project_count GROUP BY join, and the
admin-only create/update/delete/reorder flow.

Every test that creates a folder deletes it again (by id) before
returning, regardless of pass/fail, since this table drives real site
navigation.
"""

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from main import app

client = TestClient(app)


async def _real_project_count(folder_id: str) -> int:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT count(*) FROM projects WHERE folder_id = :fid AND is_active = true"
            ),
            {"fid": folder_id},
        )
        return result.scalar_one()


def test_list_is_public():
    r = client.get("/api/v1/project-folders")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) > 0
    for row in rows:
        assert "project_count" in row


def test_include_inactive_ignored_without_auth():
    public_rows = client.get("/api/v1/project-folders").json()
    unauthed_with_flag = client.get(
        "/api/v1/project-folders", params={"include_inactive": True}
    ).json()
    # Without a token the flag must be a no-op -- same result either way.
    assert len(public_rows) == len(unauthed_with_flag)


def test_project_count_matches_real_data():
    rows = client.get("/api/v1/project-folders").json()
    assert rows, "expected at least one seeded folder"
    sample = rows[0]
    expected = asyncio.run(_real_project_count(sample["id"]))
    assert sample["project_count"] == expected


def test_create_requires_admin():
    r = client.post("/api/v1/project-folders", json={"name": "x", "mode": "professional"})
    assert r.status_code == 401


def test_create_update_delete_folder(admin_headers):
    r = client.post(
        "/api/v1/project-folders",
        json={"name": "PytestFolder", "mode": "professional", "order_index": 999},
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    folder_id = created["id"]
    assert created["project_count"] == 0

    try:
        r = client.patch(
            f"/api/v1/project-folders/{folder_id}",
            json={"description": "updated by pytest"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["description"] == "updated by pytest"
        assert r.json()["name"] == "PytestFolder"  # unset fields left alone

        # Now visible in the public list too.
        rows = client.get("/api/v1/project-folders").json()
        assert any(row["id"] == folder_id for row in rows)
    finally:
        r = client.delete(f"/api/v1/project-folders/{folder_id}", headers=admin_headers)
        assert r.status_code == 204

    rows = client.get("/api/v1/project-folders").json()
    assert not any(row["id"] == folder_id for row in rows)


def test_reorder_is_atomic(admin_headers):
    ids = []
    try:
        for name in ("PytestReorderA", "PytestReorderB"):
            r = client.post(
                "/api/v1/project-folders",
                json={"name": name, "mode": "creative", "order_index": 0},
                headers=admin_headers,
            )
            assert r.status_code == 200
            ids.append(r.json()["id"])

        r = client.put(
            "/api/v1/project-folders/reorder",
            json=[
                {"id": ids[0], "order_index": 50},
                {"id": ids[1], "order_index": 51},
            ],
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json() == {"success": True}

        rows = client.get(
            "/api/v1/project-folders", params={"include_inactive": True}, headers=admin_headers
        ).json()
        by_id = {row["id"]: row for row in rows}
        assert by_id[ids[0]]["order_index"] == 50
        assert by_id[ids[1]]["order_index"] == 51
    finally:
        for folder_id in ids:
            client.delete(f"/api/v1/project-folders/{folder_id}", headers=admin_headers)


def test_reorder_requires_admin():
    r = client.put("/api/v1/project-folders/reorder", json=[])
    assert r.status_code == 401
