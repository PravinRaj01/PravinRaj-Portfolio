"""Password hashing and JWT issuance/verification. See MIGRATION_PLAN.md §8.

scripts/create_admin.py uses hash_password() from here too, so there's one
argon2 configuration for the whole app.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

_password_hash = PasswordHash.recommended()  # argon2

# A session can be renewed in the background (POST /auth/refresh), but only
# until this long after the password was last actually typed -- so a leaked
# token can't be refreshed indefinitely.
MAX_SESSION_AGE = timedelta(days=7)


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _password_hash.verify(password, hashed)


def create_access_token(
    *, user_id: uuid.UUID, email: str, auth_time: datetime | None = None
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        # When the password was really entered. A refresh passes the original
        # value back in, so it is carried forward unchanged.
        "auth_time": int((auth_time or now).timestamp()),
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class InvalidTokenError(Exception):
    pass


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc


def token_auth_time(payload: dict[str, Any]) -> datetime | None:
    """When the password behind this token was entered. Tokens issued before
    `auth_time` existed fall back to `iat`, which for them is the same moment."""
    raw = payload.get("auth_time", payload.get("iat"))
    if not isinstance(raw, (int, float)):
        return None
    return datetime.fromtimestamp(raw, tz=timezone.utc)
