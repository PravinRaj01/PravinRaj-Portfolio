"""POST /auth/refresh: renews a still-valid admin token without a password,
carries the original `auth_time` forward, and refuses once that is older than
the 7-day cap (issue #5: the admin used to be logged out an hour
after typing their password, mid-edit).

Tokens here are minted directly with PyJWT using the real admin's `sub`
(read from the session login in conftest), so the cases that need an old or
legacy-shaped token don't depend on waiting for real time to pass.
"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import decode_access_token
from main import app

client = TestClient(app)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _mint(sub: str, email: str, **claims) -> str:
    """A token signed like the real ones, with exactly the claims given."""
    return jwt.encode({"sub": sub, "email": email, **claims}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _now_plus(**delta) -> datetime:
    return datetime.now(timezone.utc) + timedelta(**delta)


def test_refresh_requires_a_token():
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_refresh_rejects_a_garbage_token():
    assert client.post("/api/v1/auth/refresh", headers=_bearer("not-a-jwt")).status_code == 401


def test_refresh_returns_a_new_working_token(admin_token):
    original = decode_access_token(admin_token)

    r = client.post("/api/v1/auth/refresh", headers=_bearer(admin_token))
    assert r.status_code == 200
    body = r.json()
    new = decode_access_token(body["access_token"])

    assert new["sub"] == original["sub"]
    assert body["user"]["email"] == original["email"]
    # The password was not re-entered, so the original moment is kept...
    assert new["auth_time"] == original["auth_time"]
    # ...while the expiry window moves forward.
    assert new["exp"] >= original["exp"]
    # And the new token is accepted by a protected route.
    me = client.get("/api/v1/auth/me", headers=_bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == original["email"]


def test_refresh_is_refused_after_the_session_age_cap(admin_token):
    real = decode_access_token(admin_token)
    old = _mint(
        real["sub"], real["email"],
        iat=_now_plus(days=-8), auth_time=int(_now_plus(days=-8).timestamp()), exp=_now_plus(minutes=30),
    )
    r = client.post("/api/v1/auth/refresh", headers=_bearer(old))
    assert r.status_code == 401
    assert "log in again" in r.json()["detail"].lower()


def test_refresh_is_allowed_just_inside_the_age_cap(admin_token):
    real = decode_access_token(admin_token)
    recent = _mint(
        real["sub"], real["email"],
        iat=_now_plus(days=-6), auth_time=int(_now_plus(days=-6).timestamp()), exp=_now_plus(minutes=30),
    )
    assert client.post("/api/v1/auth/refresh", headers=_bearer(recent)).status_code == 200


def test_refresh_rejects_an_already_expired_token(admin_token):
    real = decode_access_token(admin_token)
    expired = _mint(real["sub"], real["email"], iat=_now_plus(hours=-2), exp=_now_plus(hours=-1))
    assert client.post("/api/v1/auth/refresh", headers=_bearer(expired)).status_code == 401


def test_refresh_accepts_a_legacy_token_with_no_auth_time(admin_token):
    # Tokens issued before auth_time existed carry only `iat`; they must keep
    # working and simply use it as the session start.
    real = decode_access_token(admin_token)
    legacy = _mint(real["sub"], real["email"], iat=_now_plus(minutes=-10), exp=_now_plus(minutes=50))
    r = client.post("/api/v1/auth/refresh", headers=_bearer(legacy))
    assert r.status_code == 200
    assert "auth_time" in decode_access_token(r.json()["access_token"])
