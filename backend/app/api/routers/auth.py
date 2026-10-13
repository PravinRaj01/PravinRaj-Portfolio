# app/api/routers/auth.py — MIGRATION_PLAN.md §7 (auth row) and §8
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.security import (
    MAX_SESSION_AGE,
    create_access_token,
    decode_access_token,
    hash_password,
    token_auth_time,
    verify_password,
)
from app.models.auth import AdminUser
from app.schemas.auth import AdminUserRead, LoginRequest, TokenResponse
from app.services import login_throttle

router = APIRouter(prefix="/auth", tags=["auth"])

# Precomputed once at import time so a nonexistent email still costs one real
# argon2 verify -- otherwise "email not found" would return measurably
# faster than "wrong password", leaking which emails have accounts.
_DUMMY_HASH = hash_password("not-a-real-password-used-only-for-timing")


def _client_ip(request: Request) -> str:
    # Vercel (and most proxies) set X-Forwarded-For as "client, proxy1, proxy2";
    # the first entry is the real client. Falls back to the direct connection
    # for local dev, where there's no proxy in front of uvicorn.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]
) -> TokenResponse:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
    )
    rate_limited = HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many login attempts. Please try again later.",
    )

    ip = _client_ip(request)
    if await login_throttle.is_rate_limited(db, email=payload.email, ip=ip):
        raise rate_limited

    user = (
        await db.execute(select(AdminUser).where(AdminUser.email == payload.email))
    ).scalar_one_or_none()

    hashed = user.password_hash if user is not None else _DUMMY_HASH
    password_ok = verify_password(payload.password, hashed)
    success = user is not None and user.is_active and password_ok

    await login_throttle.record_attempt(db, email=payload.email, ip=ip, succeeded=success)

    if not success:
        raise unauthorized

    token = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(access_token=token, user=AdminUserRead.model_validate(user))


# Only used to read the raw token inside /refresh: require_admin has already
# validated it by the time the handler runs.
_bearer = HTTPBearer(auto_error=False)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    current_user: Annotated[AdminUser, Depends(require_admin)],
) -> TokenResponse:
    """Swap a still-valid token for a fresh one, so an admin who is actively
    working isn't logged out an hour after typing their password.

    The new token keeps the original `auth_time`, and refusing once that is
    older than MAX_SESSION_AGE means a real password login is still needed at
    least weekly. Takes no password, so it isn't run through login_throttle.
    """
    payload = decode_access_token(credentials.credentials) if credentials else {}
    auth_time = token_auth_time(payload)
    too_old = auth_time is None or datetime.now(timezone.utc) - auth_time > MAX_SESSION_AGE
    if too_old:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is too old to renew. Please log in again.",
        )
    token = create_access_token(user_id=current_user.id, email=current_user.email, auth_time=auth_time)
    return TokenResponse(access_token=token, user=AdminUserRead.model_validate(current_user))


@router.get("/me", response_model=AdminUserRead)
async def get_me(current_user: Annotated[AdminUser, Depends(require_admin)]) -> AdminUserRead:
    return AdminUserRead.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: Annotated[AdminUser, Depends(require_admin)]) -> dict[str, bool]:
    # JWTs are stateless: there's no server-side session to invalidate. The
    # frontend drops the token client-side (src/services/authService.ts).
    return {"success": True}
