"""Shared fixtures for tests that exercise admin-only (write) routes --
the first tests in this suite to need a real bearer token, since every
prior phase only built read-only public endpoints.

MIGRATION_PLAN.md §13 production pass: this suite writes real rows (see the
class docstring in most test_*_routes.py files), so it must never run
against the production database. TEST_DATABASE_URL / TEST_DATABASE_URL_DIRECT
point at a Neon branch created from main -- copying them into DATABASE_URL /
DATABASE_URL_DIRECT here, before `main` (and therefore app.db.session) is
imported, is what makes the whole app -- not just these fixtures -- run
against the test branch. pydantic-settings gives real environment variables
precedence over backend/.env, so this override wins even though .env sets
DATABASE_URL too.
"""

import os
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values

# backend/.env.test (gitignored) holds the Neon test-branch URLs and
# ADMIN_TEST_PASSWORD. Real environment variables take precedence, so CI can
# still inject its own; a missing file just yields no values.
for _key, _value in dotenv_values(Path(__file__).resolve().parent.parent / ".env.test").items():
    if _value is not None:
        os.environ.setdefault(_key, _value)

_TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")
_TEST_DB_URL_DIRECT = os.environ.get("TEST_DATABASE_URL_DIRECT")

if not _TEST_DB_URL or not _TEST_DB_URL_DIRECT:
    print(
        "\nTEST_DATABASE_URL and TEST_DATABASE_URL_DIRECT must both be set to a Neon "
        "test branch before running this suite -- it writes real rows, and running "
        "it against the production DATABASE_URL in backend/.env would corrupt live "
        "data.\n\nCreate a branch in the Neon console (Branches -> Create branch, "
        "parent: main) and export its pooled/direct connection strings under "
        "these two names.\n",
        file=sys.stderr,
    )
    raise SystemExit(1)

os.environ["DATABASE_URL"] = _TEST_DB_URL
os.environ["DATABASE_URL_DIRECT"] = _TEST_DB_URL_DIRECT

from fastapi.testclient import TestClient  # noqa: E402 -- must follow the env override above

from main import app  # noqa: E402 -- must follow the env override above

client = TestClient(app)

# The real seeded admin (scripts/create_admin.py). The password isn't
# stored anywhere in the repo -- pass it via env var when running locally;
# CI would need its own ADMIN_TEST_PASSWORD secret.
ADMIN_EMAIL = "pravinrajggb@gmail.com"


@pytest.fixture(scope="session")
def admin_token() -> str:
    password = os.environ.get("ADMIN_TEST_PASSWORD")
    if not password:
        pytest.skip("ADMIN_TEST_PASSWORD not set -- skipping admin-authenticated tests")
    r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": password})
    if r.status_code != 200:
        pytest.fail(f"admin login failed ({r.status_code}): {r.text}")
    return r.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
