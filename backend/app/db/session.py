"""Async engine + session factory for the app's normal (pooled) Neon connection.

See MIGRATION_PLAN.md §3. Two Neon/asyncpg specifics matter here:
  * asyncpg rejects the libpq-style `?sslmode=require&channel_binding=require`
    query params Neon's dashboard hands out, so `app.core.config` strips them
    and this module passes `ssl` via connect_args instead.
  * Neon's pooled (-pooler) endpoint runs PgBouncer in transaction mode, which
    breaks asyncpg's prepared-statement cache across requests. NullPool plus
    statement_cache_size=0 disables both SQLAlchemy- and asyncpg-side pooling
    of prepared statements, and lets Neon do the actual connection pooling.

Alembic uses the separate, non-pooled `database_url_direct` (see alembic/env.py),
not this module.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    connect_args={"ssl": "require", "statement_cache_size": 0},
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Handlers call `await db.commit()` themselves on
    success (see MIGRATION_PLAN.md §3 note on why the commit isn't done here)."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
