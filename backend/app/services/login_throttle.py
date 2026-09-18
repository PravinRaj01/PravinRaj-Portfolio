# app/services/login_throttle.py — MIGRATION_PLAN.md §13 production pass.
#
# Vercel Functions don't share memory across instances, so an in-process
# counter can't rate-limit anything -- every attempt is recorded in Postgres
# instead, following the same window-count pattern as
# app/services/game_scores.py's submit-score throttle.
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AdminLoginAttempt

RATE_LIMIT_WINDOW = timedelta(minutes=15)
MAX_ATTEMPTS_PER_EMAIL = 5
MAX_ATTEMPTS_PER_IP = 20


async def is_rate_limited(db: AsyncSession, *, email: str, ip: str) -> bool:
    cutoff = datetime.now(timezone.utc) - RATE_LIMIT_WINDOW

    email_count = await db.scalar(
        select(func.count())
        .select_from(AdminLoginAttempt)
        .where(
            AdminLoginAttempt.email == email,
            AdminLoginAttempt.succeeded.is_(False),
            AdminLoginAttempt.created_at > cutoff,
        )
    )
    if (email_count or 0) >= MAX_ATTEMPTS_PER_EMAIL:
        return True

    ip_count = await db.scalar(
        select(func.count())
        .select_from(AdminLoginAttempt)
        .where(AdminLoginAttempt.ip == ip, AdminLoginAttempt.created_at > cutoff)
    )
    return (ip_count or 0) >= MAX_ATTEMPTS_PER_IP


async def record_attempt(db: AsyncSession, *, email: str, ip: str, succeeded: bool) -> None:
    db.add(AdminLoginAttempt(email=email, ip=ip, succeeded=succeeded))
    await db.commit()
