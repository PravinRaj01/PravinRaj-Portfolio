"""Confirms /projects/{project_id}/image-folders and /image-folders/{id}:
public list, admin-only create/update/delete, and that the path's
project_id (not whatever the body claims) is what gets stored.
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

# "Crepe.ster" -- a real seeded project (see tests/test_public_content_routes.py
# for the general pattern of reading real seeded data rather than mocking).
REAL_PROJECT_ID = "a17b2bb9-0d53-4c71-b124-4c336e6a059a"


def test_list_is_public():
    r = client.get(f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_requires_admin():
    r = client.post(
        f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders",
        json={"project_id": REAL_PROJECT_ID, "name": "x"},
    )
    assert r.status_code == 401


def test_create_update_delete_flow(admin_headers):
    r = client.post(
        f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders",
        json={
            "project_id": REAL_PROJECT_ID,
            "name": "PytestGallery",
            "images": ["a.jpg", "b.jpg"],
            "order_index": 999,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    assert created["project_id"] == REAL_PROJECT_ID
    assert created["images"] == ["a.jpg", "b.jpg"]
    folder_id = created["id"]

    try:
        rows = client.get(f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders").json()
        assert any(row["id"] == folder_id for row in rows)

        r = client.patch(
            f"/api/v1/image-folders/{folder_id}",
            json={"name": "PytestGalleryRenamed"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "PytestGalleryRenamed"
        assert r.json()["images"] == ["a.jpg", "b.jpg"]  # unset fields untouched
    finally:
        r = client.delete(f"/api/v1/image-folders/{folder_id}", headers=admin_headers)
        assert r.status_code == 204

    rows = client.get(f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders").json()
    assert not any(row["id"] == folder_id for row in rows)


def test_path_project_id_is_authoritative_over_body(admin_headers):
    # Body claims a different (bogus but well-formed) project_id; the path's
    # real project_id must win, not silently succeed with the wrong owner.
    bogus_id = "00000000-0000-0000-0000-000000000000"
    r = client.post(
        f"/api/v1/projects/{REAL_PROJECT_ID}/image-folders",
        json={"project_id": bogus_id, "name": "PytestOwnership"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    created = r.json()
    try:
        assert created["project_id"] == REAL_PROJECT_ID
    finally:
        client.delete(f"/api/v1/image-folders/{created['id']}", headers=admin_headers)
