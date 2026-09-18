# app/api/deps.py — MIGRATION_PLAN.md §2 (api/deps.py: get_db, require_admin)
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import get_db
from app.models.auth import AdminUser

__all__ = ["get_db", "require_admin", "get_optional_admin"]

_bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def require_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUser:
    if credentials is None:
        raise _UNAUTHORIZED

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise _UNAUTHORIZED from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise _UNAUTHORIZED from exc

    user = await db.get(AdminUser, user_id)
    if user is None or not user.is_active:
        raise _UNAUTHORIZED
    return user


async def get_optional_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUser | None:
    """Like require_admin, but never raises -- returns None for a missing,
    invalid, expired, or inactive-user token instead of a 401. For routes
    that are public but change behavior for an authenticated admin (e.g.
    GET /project-folders?include_inactive=, where the plan marks the
    inactive-including view as admin-only but the endpoint itself is P)."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (InvalidTokenError, KeyError, ValueError):
        return None
    user = await db.get(AdminUser, user_id)
    if user is None or not user.is_active:
        return None
    return user
