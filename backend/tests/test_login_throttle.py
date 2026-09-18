"""Confirms login rate limiting (MIGRATION_PLAN.md §13 production pass) --
attempts are stored in Postgres, not memory, since Vercel Functions don't
share memory across instances.

Most of this is tested directly against app/services/login_throttle.py with
a fabricated email + IP per test (cleaned up in a finally block, like every
other write test in this suite): that avoids the real fragility risk of
driving the shared threshold through the actual HTTP endpoint, where every
call comes from the same TestClient "IP" and would accumulate across test
runs within the same 15-minute window. One thin end-to-end test still drives
the real /auth/login route, to prove the service is actually wired in --
those six rows are left in place afterward: admin_login_attempts is an audit
log, not display content, so (like the real thing) it's expected to
accumulate rows rather than be reset after each check.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db.session import SessionLocal
from app.models.auth import AdminLoginAttempt
from app.services import login_throttle
from main import app

client = TestClient(app)


def _fake_email() -> str:
    return f"login-throttle-test-{uuid.uuid4().hex}@example.com"


def _fake_ip() -> str:
    return f"203.0.113.{uuid.uuid4().int % 256}-{uuid.uuid4().hex[:8]}"


async def _cleanup(email: str | None = None, ip: str | None = None) -> None:
    async with SessionLocal() as db:
        if email is not None:
            await db.execute(delete(AdminLoginAttempt).where(AdminLoginAttempt.email == email))
        if ip is not None:
            await db.execute(delete(AdminLoginAttempt).where(AdminLoginAttempt.ip == ip))
        await db.commit()


@pytest.mark.asyncio
async def test_not_rate_limited_with_no_attempts():
    email, ip = _fake_email(), _fake_ip()
    async with SessionLocal() as db:
        assert await login_throttle.is_rate_limited(db, email=email, ip=ip) is False


@pytest.mark.asyncio
async def test_rate_limited_after_max_failed_attempts_for_email():
    email, ip = _fake_email(), _fake_ip()
    try:
        async with SessionLocal() as db:
            for _ in range(login_throttle.MAX_ATTEMPTS_PER_EMAIL):
                await login_throttle.record_attempt(db, email=email, ip=ip, succeeded=False)
            assert await login_throttle.is_rate_limited(db, email=email, ip=ip) is True
    finally:
        await _cleanup(email=email)


@pytest.mark.asyncio
async def test_email_limit_is_isolated_per_email():
    exhausted_email, other_email, ip = _fake_email(), _fake_email(), _fake_ip()
    try:
        async with SessionLocal() as db:
            for _ in range(login_throttle.MAX_ATTEMPTS_PER_EMAIL):
                await login_throttle.record_attempt(db, email=exhausted_email, ip=ip, succeeded=False)
            assert await login_throttle.is_rate_limited(db, email=exhausted_email, ip=ip) is True
            # A different email from the same IP is still under the (much
            # higher) per-IP cap, so it must not be blocked.
            assert await login_throttle.is_rate_limited(db, email=other_email, ip=ip) is False
    finally:
        await _cleanup(ip=ip)


@pytest.mark.asyncio
async def test_successful_attempts_dont_count_toward_email_limit():
    # The email-limit query filters on succeeded.is_(False) -- successful
    # logins (e.g. an admin logging in repeatedly) must never lock the
    # account out.
    email, ip = _fake_email(), _fake_ip()
    try:
        async with SessionLocal() as db:
            for _ in range(login_throttle.MAX_ATTEMPTS_PER_EMAIL + 5):
                await login_throttle.record_attempt(db, email=email, ip=ip, succeeded=True)
            assert await login_throttle.is_rate_limited(db, email=email, ip=ip) is False
    finally:
        await _cleanup(email=email)


@pytest.mark.asyncio
async def test_rate_limited_after_max_attempts_for_ip_across_emails():
    ip = _fake_ip()
    emails = [_fake_email() for _ in range(login_throttle.MAX_ATTEMPTS_PER_IP)]
    try:
        async with SessionLocal() as db:
            for email in emails:
                await login_throttle.record_attempt(db, email=email, ip=ip, succeeded=False)
            # Every individual email is well under its own cap, but the
            # shared IP has now made MAX_ATTEMPTS_PER_IP attempts total.
            assert await login_throttle.is_rate_limited(db, email=_fake_email(), ip=ip) is True
    finally:
        await _cleanup(ip=ip)


def test_login_endpoint_returns_429_after_repeated_failures():
    # Thin end-to-end check that /auth/login actually calls the throttle --
    # the threshold behavior itself is covered above.
    email = _fake_email()
    for _ in range(login_throttle.MAX_ATTEMPTS_PER_EMAIL):
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"})
        assert r.status_code == 401

    r = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"})
    assert r.status_code == 429
    assert "too many" in r.json()["detail"].lower()
