"""GET /api/v1/ai/repo-status: has a project's GitHub repository been pushed to
since the project was last synced? GitHub is stubbed; the projects are real rows
on the Neon test branch, created and removed by each test."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.services import github_repo
from main import app

client = TestClient(app)
URL = "/api/v1/ai/repo-status"


@pytest.fixture
def make_project(admin_headers):
    created: list[str] = []

    def make(**over) -> str:
        body = {
            "title": f"sync-test-{uuid.uuid4().hex[:8]}", "description": "d", "mode": "professional",
            "category": "Test", **over,
        }
        r = client.post("/api/v1/projects", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        created.append(r.json()["id"])
        return r.json()["id"]

    yield make
    for project_id in created:
        client.delete(f"/api/v1/projects/{project_id}", headers=admin_headers)


@pytest.fixture
def remote(monkeypatch):
    """Canned `pushed_at` per (owner, repo); a repo missing from it is unreadable."""
    table: dict[tuple[str, str], str | None] = {}

    async def fake(pairs):
        return {pair: table[pair] for pair in pairs if pair in table}

    monkeypatch.setattr(github_repo, "fetch_many_pushed_at", fake)
    return table


def states(headers, mode="professional"):
    r = client.get(URL, params={"mode": mode}, headers=headers)
    assert r.status_code == 200, r.text
    return {row["project_id"]: row["state"] for row in r.json()}


def test_the_route_requires_admin():
    assert client.get(URL, params={"mode": "professional"}).status_code == 401


def test_an_unknown_mode_is_rejected(admin_headers):
    assert client.get(URL, params={"mode": "weird"}, headers=admin_headers).status_code == 422


def test_each_project_is_classified(admin_headers, make_project, remote):
    remote[("octo", "synced")] = "2025-01-01T00:00:00Z"
    remote[("octo", "moved")] = "2025-03-01T00:00:00Z"
    remote[("octo", "fresh")] = "2025-01-01T00:00:00Z"
    ids = {
        "up_to_date": make_project(github_url="https://github.com/octo/synced", github_pushed_at="2025-01-01T00:00:00Z"),
        "changed": make_project(github_url="https://github.com/octo/moved", github_pushed_at="2025-01-01T00:00:00Z"),
        "never_synced": make_project(github_url="https://github.com/octo/fresh"),
        "unavailable": make_project(github_url="https://github.com/octo/gone", github_pushed_at="2025-01-01T00:00:00Z"),
    }
    not_github = make_project(github_url="https://example.com/not/github")
    no_url = make_project()
    got = states(admin_headers)
    for expected, project_id in ids.items():
        assert got[project_id] == expected
    assert got[not_github] == "unavailable"
    assert no_url not in got  # no repo, nothing to report


def test_other_modes_are_not_included(admin_headers, make_project, remote):
    remote[("octo", "synced")] = "2025-01-01T00:00:00Z"
    creative = make_project(mode="creative", github_url="https://github.com/octo/synced")
    assert creative not in states(admin_headers, "professional")
    assert creative in states(admin_headers, "creative")


def test_synced_state_round_trips_through_the_project_api(admin_headers, make_project):
    project_id = make_project(github_url="https://github.com/octo/hello")
    r = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"github_pushed_at": "2025-01-02T09:00:00Z", "github_synced_at": "2025-02-01T00:00:00Z"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["github_pushed_at"] == "2025-01-02T09:00:00Z"
    assert r.json()["github_synced_at"].startswith("2025-02-01T00:00:00")
