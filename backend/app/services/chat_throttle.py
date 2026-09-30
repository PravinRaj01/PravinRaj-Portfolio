# app/services/chat_throttle.py — rate limit for the public /ai/chat route.
#
# Vercel Functions don't share memory across instances (see
# app/services/login_throttle.py), so this counts rows in Postgres, same
# window-count pattern. Gemini/Groq free-tier quotas are shared across every
# visitor to the site, so one person could otherwise exhaust a shared daily
# quota by themselves.
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import ChatRequestLog

RATE_LIMIT_WINDOW = timedelta(minutes=10)
MAX_REQUESTS_PER_IP = 20


async def is_rate_limited(db: AsyncSession, *, ip: str) -> bool:
    cutoff = datetime.now(timezone.utc) - RATE_LIMIT_WINDOW
    count = await db.scalar(
        select(func.count())
        .select_from(ChatRequestLog)
        .where(ChatRequestLog.ip == ip, ChatRequestLog.created_at > cutoff)
    )
    return (count or 0) >= MAX_REQUESTS_PER_IP


async def record_request(db: AsyncSession, *, ip: str) -> None:
    db.add(ChatRequestLog(ip=ip))
    await db.commit()
