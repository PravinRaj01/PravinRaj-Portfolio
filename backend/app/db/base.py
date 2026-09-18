"""SQLAlchemy 2.0 declarative base, naming convention, and shared column mixins.

See MIGRATION_PLAN.md §3. Every model in app/models/ inherits from Base plus
UUIDPk and one of the two Timestamps mixins (which one depends on whether the
source Supabase column was nullable — see the [TS]/[SQL] notes per model).
"""

import uuid
from datetime import datetime

from sqlalchemy import MetaData, func, text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Matches the constraint/index names Postgres (and Supabase) generate by default,
# so Alembic autogenerate output lines up with names already referenced elsewhere
# in this codebase (e.g. "projects_slug_unique", "github_ticker_mode_unique").
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "%(table_name)s_%(column_0_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s_check",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "pk": "%(table_name)s_pkey",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPk:
    """Primary key matching Supabase's `id uuid default gen_random_uuid()`."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


# Ground truth from the production pg_dump (db_cluster-*.backup): 7 tables
# (about_content, contact_content, hero_content, services, site_settings,
# skills, stats) default created_at/updated_at to this expression instead of
# plain now(); the rest use plain now() (see TimestampsRequired/Nullable
# below). Both resolve to the same UTC instant once stored in a timestamptz
# column, but the exact default expression is kept for 1:1 fidelity.
UTC_NOW = text("timezone('utc'::text, now())")


class TimestampsRequired:
    """created_at/updated_at NOT NULL — used where types.ts has `string` (not `string | null`)."""

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TimestampsNullable:
    """created_at/updated_at NULLABLE — used where types.ts has `string | null`."""

    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, server_default=func.now(), onupdate=func.now()
    )
