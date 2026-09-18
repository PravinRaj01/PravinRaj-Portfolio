# app/services/visitor.py — MIGRATION_PLAN.md §7
#
# Fixes the read-then-write race in the original track-visitor Edge Function
# (it read view_count, added 1 in JS, then wrote it back -- concurrent
# requests could read the same value and both write count+1, losing an
# increment). Both statements here are single atomic SQL statements
# (UPDATE...RETURNING and INSERT...ON CONFLICT...RETURNING), so concurrent
# requests serialize on the row instead of racing in application code.
from typing import Literal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import VisitorDailyStats


async def increment(db: AsyncSession) -> tuple[int, int]:
    total = (
        await db.execute(
            text(
                "UPDATE visitor_stats SET view_count = view_count + 1, last_updated = now() "
                "WHERE id = (SELECT id FROM visitor_stats LIMIT 1) RETURNING view_count"
            )
        )
    ).scalar_one_or_none()
    if total is None:
        total = (
            await db.execute(
                text("INSERT INTO visitor_stats (view_count) VALUES (1) RETURNING view_count")
            )
        ).scalar_one()

    # "Today" is the UTC date, matching the original Edge Function's
    # `new Date().toISOString()` split. Computed in SQL rather than trusting
    # a session-level time zone setting, which Neon's pooled (transaction
    # mode) endpoint doesn't reliably persist between statements.
    today = (
        await db.execute(
            text(
                "INSERT INTO visitor_daily_stats (date, view_count) "
                "VALUES ((now() AT TIME ZONE 'UTC')::date, 1) "
                "ON CONFLICT (date) DO UPDATE SET view_count = visitor_daily_stats.view_count + 1 "
                "RETURNING view_count"
            )
        )
    ).scalar_one()

    await db.commit()
    return total, today


async def get_counts(db: AsyncSession) -> tuple[int, int]:
    total = (
        await db.execute(text("SELECT view_count FROM visitor_stats LIMIT 1"))
    ).scalar_one_or_none() or 0
    today = (
        await db.execute(
            text(
                "SELECT view_count FROM visitor_daily_stats "
                "WHERE date = (now() AT TIME ZONE 'UTC')::date"
            )
        )
    ).scalar_one_or_none() or 0
    return total, today


async def get_daily_stats(
    db: AsyncSession, range_: Literal["7days", "30days", "all"]
) -> list[VisitorDailyStats]:
    stmt = select(VisitorDailyStats).order_by(VisitorDailyStats.date.asc())
    if range_ != "all":
        days = 7 if range_ == "7days" else 30
        # UTC to match how "today" is computed everywhere else in this
        # service (increment/get_counts), not the DB server's local time zone.
        stmt = stmt.where(
            VisitorDailyStats.date >= text(f"(now() AT TIME ZONE 'UTC')::date - {days}")
        )
    result = await db.execute(stmt)
    return list(result.scalars().all())
