# app/api/routers/auth.py — MIGRATION_PLAN.md §7 (auth row) and §8
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.security import create_access_token, hash_password, verify_password
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


@router.get("/me", response_model=AdminUserRead)
async def get_me(current_user: Annotated[AdminUser, Depends(require_admin)]) -> AdminUserRead:
    return AdminUserRead.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: Annotated[AdminUser, Depends(require_admin)]) -> dict[str, bool]:
    # JWTs are stateless: there's no server-side session to invalidate. The
    # frontend drops the token client-side (src/services/authService.ts).
    return {"success": True}
