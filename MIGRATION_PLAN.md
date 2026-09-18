# Migration Plan: Supabase → FastAPI + Neon Postgres + Cloudflare R2

This document reverse-engineers the current Supabase schema from `supabase/migrations/` and `src/integrations/supabase/types.ts`. It then specifies the backend that replaces it:
- SQLAlchemy 2.0 async models
- Alembic migrations
- Pydantic v2 schemas
- FastAPI routers

Read it alongside:
- [`CLAUDE.md`](CLAUDE.md): operating rules (Plan Mode first, no blind overwrites, explicit async)
- [`SUPABASE_MIGRATION_INVENTORY.md`](SUPABASE_MIGRATION_INVENTORY.md): which tables, buckets, auth flows and Edge Functions are in use

Decisions baked into this document:
1. **Infer and flag.** Where the SQL doesn't prove a column's type, it's inferred from `types.ts` and listed in the §5 VERIFY table. Confirm those rows against a live `pg_dump` before cutover.
2. **1:1 fidelity port.** Every existing column is kept, including legacy duplicates (marked `# LEGACY`). Data copies over unchanged and frontend response shapes stay the same. Clean-up is a later migration.
3. **Full stack.** SQLAlchemy 2.0 async (asyncpg), Alembic, Pydantic v2 and FastAPI.

Status: **design only.** No `backend/` code exists yet. Build it in small, verifiable steps, as `CLAUDE.md` requires.

---

## §1 Findings from the schema scan

1. **The migrations folder is not a complete schema.**
   - The oldest file (`20251219145952_…sql`) already runs `ALTER TABLE hero_content`.
   - Only 7 tables have real `CREATE TABLE` DDL on disk: `github_ticker`, `game_scores`, `project_folders`, `project_image_folders`, `visitor_stats`, `visitor_daily_stats`, `magazine_issues`.
   - The other 13 were created through the Lovable UI. Their shape comes from `src/integrations/supabase/types.ts`, which is exact for nullability and insert-optionality but not for Postgres types.
2. **Columns that exist in `types.ts` but have no migration:**
   - `projects.image_scroll_enabled`
   - `project_image_folders.media_type`, `.video_url`, `.video_thumbnail`
3. **Unique constraints implied but never recorded:**
   - `useContactContent.ts:29` upserts with `onConflict: 'mode'`. Postgres rejects that without a unique index, so `contact_content.mode` must be UNIQUE.
4. **Constraints proven by the SQL:**
   - `github_ticker.mode` UNIQUE
   - `projects.slug` UNIQUE (nullable)
   - `visitor_daily_stats.date` UNIQUE
   - `project_folders.mode` CHECK in ('professional', 'creative')
   - FK `projects.folder_id → project_folders.id` ON DELETE SET NULL
   - FK `project_image_folders.project_id → projects.id` ON DELETE CASCADE
5. **Indexes:**
   - `idx_game_scores_game_type_score (game_type, score DESC)`
   - `idx_projects_folder_id`
   - `idx_project_folders_mode`
   - `idx_project_image_folders_project_id`
   - `idx_visitor_daily_stats_date (date DESC)`
6. **Trigger:** `update_updated_at_column()` (plpgsql, `search_path=public`) runs BEFORE UPDATE on `project_folders`, `project_image_folders` and `magazine_issues`. The other tables probably have it too, via the UI.
7. **`submit_game_score(p_game_type, p_nickname, p_score) → json`:** the function body isn't in the repo. It gets reimplemented in Python with explicit validation: `nickname` ≤ 10 characters, `game_type` in {terminal_quest, neon_breakout}, `score` ≥ 0 and an integer.
8. **Latent bugs to fix while keeping behaviour:**
   - **Visitor count race.** `track-visitor` reads, adds 1 in JS, then writes, so concurrent requests lose counts. Fix with an atomic `UPDATE … SET view_count = view_count + 1` and `INSERT … ON CONFLICT (date) DO UPDATE`.
   - **Non-atomic publish.** `useMagazine.publishIssue` runs "unpublish all" and "publish one" as two separate calls. Fix with a single transaction.
   - **Folder reorder.** `useProjectFolders` sends N sequential updates. Fix with one transactional batch endpoint.
   - **Folder project counts.** `useProjectFolders` makes N+1 count queries. Fix with one `GROUP BY folder_id`.
9. **Security gap:** `supabase/config.toml` sets `verify_jwt = false` on every function, so `generate-description` and `generate-magazine` (paid AI calls) can be called anonymously. In FastAPI they sit behind the admin auth dependency.
10. **RLS becomes route-level auth:**
    - Public read on everything, except `magazine_issues`, where public sees only `is_published = true`.
    - Public insert on `game_scores` (through the RPC).
    - Visitor writes are server-side only.
    - All other writes are admin-only.
11. **Auth:** Supabase `auth.users` can't be carried over. The document adds a new `admin_users` table (argon2 hash) and JWT bearer tokens. The frontend keeps the session in localStorage as it does today. The `AdminUser {id, email}` contract from `authService.ts` stays the same.
12. **Storage:**
    - `resumes`: PDF only, ≤ 10 MB, key `${mode}-resume-${Date.now()}.pdf`. The public URL is written to `site_settings.{mode}_resume_url`, and the old object is deleted only if the URL belongs to the managed bucket. This moves to an R2 `resumes/` prefix.
    - `Pictures` appears only as a signed URL in `index.html`; it's a one-off copy to R2.

**Out of scope for this document (contract stubs only):** the bodies of `portfolio-chat`, `generate-description`, `generate-magazine` and `google-drive-proxy`. They don't touch the schema, beyond reading tables. They get router stubs and TODOs for a later phase.

---

## Contents

1. Findings from the schema scan (above)
2. Target backend layout and dependencies
3. Database core: engine, session, Base, mixins (Neon + asyncpg specifics)
4. Table-by-table schema, each with its SQLAlchemy 2.0 model (all 20 tables plus `admin_users`)
5. VERIFY table: inferred types to confirm against a live `pg_dump`
6. Pydantic v2 schemas: conventions and `Project*` (every table's schemas are in Appendix A)
7. FastAPI routers: endpoint map that mirrors every current `supabase.from()` / rpc / functions call
8. Auth (JWT + `admin_users`) and R2 storage service
9. Alembic setup, plus a baseline migration that reproduces constraints, indexes and the trigger
10. Data migration runbook (Supabase → Neon, Storage → R2)
11. Frontend cutover order (hook by hook)
12. Verification checklist
- Appendix A: complete Pydantic v2 schemas
- Appendix B: source traceability

## §2 Target layout (the backend goes in `backend/` so `bun run dev` keeps working)

```
backend/
  main.py                      # FastAPI app; `uvicorn main:app --reload` (per CLAUDE.md)
  pyproject.toml
  alembic.ini
  alembic/env.py               # async env, target_metadata = Base.metadata
  alembic/versions/0001_baseline.py
  app/
    core/config.py             # pydantic-settings: DATABASE_URL, JWT_*, R2_*, CORS_ORIGINS
    core/security.py           # argon2 hashing (pwdlib), JWT encode/decode (PyJWT)
    db/base.py                 # DeclarativeBase, naming convention, mixins
    db/session.py              # async engine + async_sessionmaker + get_db dependency
    models/                    # one module per domain, re-exported in __init__.py
      content.py               # about, hero, contact, stats, skills, services, socials, github_ticker
      academic.py              # education, certifications, experiences, technical_skills
      projects.py              # project_folders, projects, project_image_folders
      magazine.py              # magazine_issues
      site.py                  # site_settings
      analytics.py             # visitor_stats, visitor_daily_stats, game_scores
      auth.py                  # admin_users (NEW)
    schemas/                   # same split as models/
    api/deps.py                # get_db, require_admin
    api/routers/*.py           # one router per resource
    services/                  # visitor.py, game_scores.py, magazine.py, storage_r2.py
  scripts/create_admin.py      # seeds the first admin (async)
  scripts/copy_supabase_data.py
```

Dependencies: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]>=2.0`, `asyncpg`, `alembic`, `pydantic[email]>=2`, `pydantic-settings`, `pyjwt`, `pwdlib[argon2]`, `aioboto3` (R2 is S3-compatible), `python-multipart`.

## §3 Database core

```python
# app/db/base.py
import uuid
from datetime import datetime
from sqlalchemy import MetaData, text, func
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "%(table_name)s_%(column_0_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s_check",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",   # matches Supabase names in types.ts
    "pk": "%(table_name)s_pkey",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)

class UUIDPk:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

class TimestampsRequired:          # created_at/updated_at NOT NULL (types.ts: string)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

class TimestampsNullable:          # created_at/updated_at NULLABLE (types.ts: string | null)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, server_default=func.now(), onupdate=func.now())
```

```python
# app/db/session.py
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Neon notes:
#  * asyncpg rejects `?sslmode=require`; strip it from the URL and pass ssl via connect_args.
#  * Behind Neon's pooled (-pooler) host (PgBouncer, transaction mode), prepared statements
#    break, so disable asyncpg's statement cache and let Neon do the pooling (NullPool).
engine = create_async_engine(
    settings.database_url,              # postgresql+asyncpg://user:pass@ep-xxx-pooler.../db
    poolclass=NullPool,
    connect_args={"ssl": "require", "statement_cache_size": 0},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

**Transactions are explicit.** Every write handler calls `await db.commit()` itself, before it returns. Committing in the dependency's teardown would run after FastAPI has serialized the response (the exact timing depends on the FastAPI version). A failed commit would then be invisible to the client, which already has a 200. Keeping the commit inside the handler means a constraint error still becomes a 409.

Alembic runs against the **direct (non-pooler)** Neon URL.

Type mapping used throughout:

| Postgres | SQLAlchemy | Python |
|---|---|---|
| `uuid` | `UUID(as_uuid=True)` | `uuid.UUID` |
| `text` | `Text` | `str` |
| `varchar(n)` | `String(n)` | `str` |
| `text[]` | `ARRAY(Text)` | `list[str]` |
| `jsonb` | `JSONB` | `dict` / `list` |
| `integer` | `Integer` | `int` |
| `boolean` | `Boolean` | `bool` |
| `date` | `Date` | `datetime.date` |
| `timestamptz` | `TIMESTAMP(timezone=True)` | `datetime` |
| `numeric` (inferred) | `Numeric` | `float` via `asdecimal=False` |

Nullability follows `types.ts` (`T | null` → `Mapped[T | None]`). Server defaults follow the migration SQL where it exists; otherwise they're inferred and flagged in §5.

## §4 Tables and models (part 1: content, academic, site)

Provenance tags: **[SQL]** means DDL is on disk. **[TS]** means the shape was reconstructed from `types.ts`.

```python
# app/models/content.py
import uuid
from sqlalchemy import Boolean, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy import text as sql_text   # GithubTicker has a column named `text` (see below)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired, TimestampsNullable

class AboutContent(UUIDPk, TimestampsRequired, Base):              # [TS]
    __tablename__ = "about_content"
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    section_title: Mapped[str | None] = mapped_column(Text, server_default=text("'About Me'"))  # [SQL]
    content: Mapped[str] = mapped_column(Text, nullable=False)

class HeroContent(UUIDPk, TimestampsRequired, Base):               # [TS]
    __tablename__ = "hero_content"
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    greeting: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cta_text: Mapped[str] = mapped_column(Text, nullable=False)
    cta_link: Mapped[str | None] = mapped_column(Text, server_default=text("'/projects'"))    # [SQL]
    animated_titles: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    animation_speed: Mapped[int | None] = mapped_column(Integer)                  # VERIFY
    animation_pause_duration: Mapped[int | None] = mapped_column(Integer)         # VERIFY
    gradient_overlay_opacity: Mapped[float | None] = mapped_column(Numeric(asdecimal=False))  # VERIFY
    background_image_url: Mapped[str | None] = mapped_column(Text)
    profile_photo_url: Mapped[str | None] = mapped_column(Text)                   # [SQL]

class ContactContent(UUIDPk, TimestampsNullable, Base):            # [TS]
    __tablename__ = "contact_content"
    __table_args__ = (UniqueConstraint("mode"),)   # implied by upsert onConflict 'mode'; VERIFY
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    services: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

class Stat(UUIDPk, TimestampsRequired, Base):                      # [TS]
    __tablename__ = "stats"
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Skill(UUIDPk, TimestampsRequired, Base):                     # [TS]
    __tablename__ = "skills"
    category: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)

class Service(UUIDPk, TimestampsRequired, Base):                   # [TS]
    __tablename__ = "services"
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    features: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Social(UUIDPk, TimestampsNullable, Base):                    # [TS]
    __tablename__ = "socials"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))  # VERIFY default
    mode: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'professional'"))  # [SQL]
    order_index: Mapped[int | None] = mapped_column(Integer)

class GithubTicker(UUIDPk, TimestampsRequired, Base):              # [SQL]
    __tablename__ = "github_ticker"
    __table_args__ = (UniqueConstraint("mode", name="github_ticker_mode_unique"),)
    # The column is named `text`. Inside this class body, that name shadows sqlalchemy.text
    # from the next line on, so use the `sql_text` alias for every default here.
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'professional'"))
    text: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'More Projects on Github'"))
    url: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'https://github.com'"))
```

```python
# app/models/academic.py
from sqlalchemy import Boolean, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsNullable

class Education(UUIDPk, TimestampsNullable, Base):                 # [TS]
    __tablename__ = "education"
    degree: Mapped[str] = mapped_column(Text, nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    period: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    achievements: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default=text("'{}'"))
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Certification(UUIDPk, TimestampsNullable, Base):             # [TS] + [SQL] alters
    __tablename__ = "certifications"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    issuer: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[str] = mapped_column(Text, nullable=False)         # free text e.g. "Mar 2024"
    featured: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    credential_id: Mapped[str | None] = mapped_column(Text)         # NOT NULL dropped 2025-12-25
    credential_url: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Experience(UUIDPk, TimestampsNullable, Base):                # [TS] + [SQL] alters
    __tablename__ = "experiences"
    title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    period: Mapped[str] = mapped_column(Text, nullable=False)       # "Mar 2025 - Present"; sorted client-side
    description: Mapped[str] = mapped_column(Text, nullable=False)
    achievements: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int | None] = mapped_column(Integer)
    experience_type: Mapped[str | None] = mapped_column(Text, server_default=text("'job'"))
    date_type: Mapped[str | None] = mapped_column(Text, server_default=text("'range'"))  # 'range' | 'single'
    event_date: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(Text)
    event_images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    certificate_url: Mapped[str | None] = mapped_column(Text)
    certificate_drive_id: Mapped[str | None] = mapped_column(Text)

class TechnicalSkill(UUIDPk, TimestampsNullable, Base):            # [TS]; read-only in frontend
    __tablename__ = "technical_skills"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str | None] = mapped_column(Text)
    icon_url: Mapped[str | None] = mapped_column(Text)
    position_x: Mapped[float | None] = mapped_column(Numeric(asdecimal=False))   # VERIFY
    position_y: Mapped[float | None] = mapped_column(Numeric(asdecimal=False))   # VERIFY
    position_z: Mapped[float | None] = mapped_column(Numeric(asdecimal=False))   # VERIFY
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))  # VERIFY default
```

```python
# app/models/site.py — singleton row (the 2025-12-25 migration deduplicated it)
from sqlalchemy import Boolean, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired

class SiteSettings(UUIDPk, TimestampsRequired, Base):              # [TS] + many [SQL] alters
    __tablename__ = "site_settings"
    site_name: Mapped[str] = mapped_column(String, nullable=False)                 # LEGACY (mode-specific below)
    logo_url: Mapped[str | None] = mapped_column(Text)                             # LEGACY
    resume_url: Mapped[str | None] = mapped_column(Text)                           # LEGACY
    professional_site_name: Mapped[str | None] = mapped_column(String)
    professional_logo_url: Mapped[str | None] = mapped_column(Text)
    professional_mode_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    professional_resume_url: Mapped[str | None] = mapped_column(Text)
    professional_visible_pages: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), server_default=text("ARRAY['home','projects','experience','academic','contact','podcast']"))
    creative_site_name: Mapped[str | None] = mapped_column(String)
    creative_logo_url: Mapped[str | None] = mapped_column(Text)
    creative_mode_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    creative_resume_url: Mapped[str | None] = mapped_column(Text)
    creative_visible_pages: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), server_default=text("ARRAY['home','projects','experience','academic','contact','podcast']"))
    mode_toggle_pages: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), server_default=text("ARRAY['home','projects','experience','academic','contact','podcast']"))
    default_mode: Mapped[str | None] = mapped_column(String, server_default=text("'professional'"))
    academic_default_view: Mapped[str | None] = mapped_column(String(20), server_default=text("'cards'"))
    projects_default_view: Mapped[str | None] = mapped_column(String(20), server_default=text("'cards'"))
    visitor_counter_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    show_total_visitors: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    show_daily_visitors: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    chatbot_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    chatbot_name: Mapped[str | None] = mapped_column(Text, server_default=text("'Portfolio Assistant'"))
    chatbot_welcome_message: Mapped[str | None] = mapped_column(
        Text, server_default=text("'Hi there! 👋 I can help you learn about my skills, projects, and experience.'"))
    chatbot_default_state: Mapped[str | None] = mapped_column(Text, server_default=text("'mini'"))
```

## §4 Tables and models (part 2: projects, magazine, analytics, auth)

```python
# app/models/projects.py
import uuid
from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDPk, TimestampsRequired, TimestampsNullable

CROP_DEFAULT = text("""'{"x": 50, "y": 50}'::jsonb""")
CROP_DEFAULT_ZOOM = text("""'{"x": 50, "y": 50, "zoom": 100}'::jsonb""")

class ProjectFolder(UUIDPk, TimestampsRequired, Base):             # [SQL]
    __tablename__ = "project_folders"
    __table_args__ = (
        CheckConstraint("mode IN ('professional', 'creative')", name="mode"),
        Index("idx_project_folders_mode", "mode"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_image_drive_id: Mapped[str | None] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    projects: Mapped[list["Project"]] = relationship(back_populates="folder", passive_deletes=True)

class Project(UUIDPk, TimestampsNullable, Base):                   # [TS] base + [SQL] alters
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("slug", name="projects_slug_unique"),
        Index("idx_projects_folder_id", "folder_id"),
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str | None] = mapped_column(Text)                  # nullable + unique; generated server-side
    description: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)     # LEGACY, superseded by categories[]
    categories: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    position: Mapped[str | None] = mapped_column(Text)              # LEGACY, superseded by positions[]
    positions: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    featured: Mapped[bool | None] = mapped_column(Boolean)                                   # VERIFY default
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    show_in_recent: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    order_index: Mapped[int | None] = mapped_column(Integer)                                 # VERIFY default
    recent_order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    project_date: Mapped[str | None] = mapped_column(Text)
    image_drive_id: Mapped[str | None] = mapped_column(Text)
    image_home_drive_id: Mapped[str | None] = mapped_column(Text)
    image_scroll_enabled: Mapped[bool | None] = mapped_column(Boolean)  # no migration on disk; VERIFY
    scroll_speed: Mapped[int | None] = mapped_column(Integer, server_default=text("10000"))
    include_thumbnail_in_gallery: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    gallery_images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    video_url: Mapped[str | None] = mapped_column(Text)
    video_thumbnail_drive_id: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)            # LEGACY-ish; project_links is newer
    live_url: Mapped[str | None] = mapped_column(Text)
    project_links: Mapped[list[dict] | None] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))  # [{label,url,show_on_card}]
    crop_square: Mapped[dict | None] = mapped_column(JSONB, server_default=CROP_DEFAULT)
    crop_landscape: Mapped[dict | None] = mapped_column(JSONB, server_default=CROP_DEFAULT)
    crop_phone: Mapped[dict | None] = mapped_column(JSONB, server_default=CROP_DEFAULT_ZOOM)
    crop_tablet: Mapped[dict | None] = mapped_column(JSONB, server_default=CROP_DEFAULT_ZOOM)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_folders.id", ondelete="SET NULL"))
    folder: Mapped[ProjectFolder | None] = relationship(back_populates="projects")
    image_folders: Mapped[list["ProjectImageFolder"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True,
        order_by="ProjectImageFolder.order_index")

class ProjectImageFolder(UUIDPk, TimestampsNullable, Base):        # [SQL] + 3 [TS] columns
    __tablename__ = "project_image_folders"
    __table_args__ = (Index("idx_project_image_folders_project_id", "project_id"),)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    media_type: Mapped[str | None] = mapped_column(Text)            # no migration on disk; VERIFY
    images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'::text[]"))
    video_url: Mapped[str | None] = mapped_column(Text)             # no migration on disk
    video_thumbnail: Mapped[str | None] = mapped_column(Text)       # no migration on disk
    order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    project: Mapped[Project] = relationship(back_populates="image_folders")
```

**Async rule:** relationships are never lazy-loaded, because lazy loads fail under asyncio. Routers use `selectinload()` explicitly, or plain columns only.

```python
# app/models/magazine.py
from sqlalchemy import Boolean, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired

class MagazineIssue(UUIDPk, TimestampsRequired, Base):             # [SQL]
    __tablename__ = "magazine_issues"
    title: Mapped[str] = mapped_column(Text, nullable=False)
    is_published: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'creative'"))
    cover_headline: Mapped[str | None] = mapped_column(Text)
    cover_subhead: Mapped[str | None] = mapped_column(Text)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # MagazineContent
    project_ids: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))  # text[], not uuid[]; kept 1:1
```

```python
# app/models/analytics.py
import datetime as dt
from sqlalchemy import TIMESTAMP, Date, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk

class VisitorStats(UUIDPk, Base):                                  # [SQL] singleton counter
    __tablename__ = "visitor_stats"
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_updated: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

class VisitorDailyStats(UUIDPk, Base):                             # [SQL]
    __tablename__ = "visitor_daily_stats"
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, unique=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

class GameScore(UUIDPk, Base):                                     # [SQL]
    __tablename__ = "game_scores"
    nickname: Mapped[str] = mapped_column(String(10), nullable=False)
    game_type: Mapped[str] = mapped_column(String(20), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

# DESC indexes are declared after the classes, bound to real columns. An Index built only
# from text() has no column to attach it to a table, and Alembic autogenerate renders it badly.
Index("idx_visitor_daily_stats_date", VisitorDailyStats.date.desc())
Index("idx_game_scores_game_type_score", GameScore.game_type, GameScore.score.desc())
```

```python
# app/models/auth.py — NEW (replaces Supabase auth.users)
from sqlalchemy import Boolean, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired

class AdminUser(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "admin_users"
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)   # argon2 via pwdlib
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
```

`app/models/__init__.py` imports every model so Alembic autogenerate sees all 21 tables.

## §5 VERIFY table (confirm before cutover)

Run: `pg_dump --schema-only --schema=public --no-owner "$SUPABASE_DB_URL" > supabase_schema.sql`, then diff against `alembic upgrade head --sql`.

| Table.column | Assumed | Why uncertain |
|---|---|---|
| hero_content.gradient_overlay_opacity | `numeric` | TS `number`; could be real/float8 |
| hero_content.animation_speed / animation_pause_duration | `integer` | TS `number`; migration sets 500 |
| technical_skills.position_x/y/z | `numeric` | TS `number` |
| contact_content.mode | UNIQUE | only implied by `onConflict: 'mode'` |
| socials.enabled, technical_skills.is_active | default `true` | base DDL missing |
| projects.featured, projects.order_index | no default | base DDL missing |
| projects.image_scroll_enabled | boolean, no default | column has no migration |
| project_image_folders.media_type / video_url / video_thumbnail | text | columns have no migration |
| site_settings.site_name, professional_/creative_site_name | varchar (no length) | `character varying` in SQL; base unknown |
| all `mode` text columns (except project_folders) | no CHECK | may exist in live DB |
| `update_updated_at_column` trigger | on 3 tables only | may be attached to all tables in live DB |
| `submit_game_score` | body unknown | validation rules reimplemented in §7 |
| All UI-created tables | RLS/policies ignored | replaced by route auth |

## §6 Pydantic v2 schemas

The pattern is the same for every table. Field names match column names exactly, so the frontend's JSON contract (and `types.ts`) doesn't change.

```python
# app/schemas/common.py
import uuid
from typing import Literal
from pydantic import BaseModel, ConfigDict

Mode = Literal["professional", "creative"]

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class ReorderItem(BaseModel):
    id: uuid.UUID
    order_index: int
```

```python
# app/schemas/projects.py — Project* schemas (every other table's schemas are in Appendix A)
class CropPosition(BaseModel):
    x: float = 50
    y: float = 50
    zoom: float | None = None

class ProjectLink(BaseModel):
    label: str
    url: str
    show_on_card: bool = False

class ProjectBase(BaseModel):
    title: str
    description: str
    mode: Mode
    category: str                                   # LEGACY but still NOT NULL
    categories: list[str] | None = None
    position: str | None = None
    positions: list[str] | None = None
    tags: list[str] | None = None
    featured: bool | None = None
    is_active: bool | None = None
    show_in_recent: bool | None = None
    order_index: int | None = None
    recent_order_index: int | None = None
    project_date: str | None = None
    image_drive_id: str | None = None
    image_home_drive_id: str | None = None
    image_scroll_enabled: bool | None = None
    scroll_speed: int | None = None
    include_thumbnail_in_gallery: bool | None = None
    gallery_images: list[str] | None = None
    video_url: str | None = None
    video_thumbnail_drive_id: str | None = None
    github_url: str | None = None
    live_url: str | None = None
    project_links: list[ProjectLink] | None = None
    crop_square: CropPosition | None = None
    crop_landscape: CropPosition | None = None
    crop_phone: CropPosition | None = None
    crop_tablet: CropPosition | None = None
    folder_id: uuid.UUID | None = None
    slug: str | None = None

class ProjectCreate(ProjectBase): pass

class ProjectUpdate(BaseModel):                     # PATCH: every field optional; only sent fields are applied
    model_config = ConfigDict(extra="forbid")
    title: str | None = None
    description: str | None = None
    mode: Mode | None = None
    category: str | None = None
    categories: list[str] | None = None
    position: str | None = None
    positions: list[str] | None = None
    tags: list[str] | None = None
    featured: bool | None = None
    is_active: bool | None = None
    show_in_recent: bool | None = None
    order_index: int | None = None
    recent_order_index: int | None = None
    project_date: str | None = None
    image_drive_id: str | None = None
    image_home_drive_id: str | None = None
    image_scroll_enabled: bool | None = None
    scroll_speed: int | None = None
    include_thumbnail_in_gallery: bool | None = None
    gallery_images: list[str] | None = None
    video_url: str | None = None
    video_thumbnail_drive_id: str | None = None
    github_url: str | None = None
    live_url: str | None = None
    project_links: list[ProjectLink] | None = None
    crop_square: CropPosition | None = None
    crop_landscape: CropPosition | None = None
    crop_phone: CropPosition | None = None
    crop_tablet: CropPosition | None = None
    folder_id: uuid.UUID | None = None
    slug: str | None = None

class ProjectRead(ProjectBase, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None
```

Update semantics: routers apply `payload.model_dump(exclude_unset=True)`. This matches Supabase `.update(partial)`, so only the fields that were sent change.

Nested JSONB schemas:
- `MagazineContent`: `cover`, `editors_note`, `articles[]` (with `layout: Literal['split_left','split_right','full_bleed']`) and `closing`. This mirrors `src/types/magazine.ts`.
- `CropPosition` and `ProjectLink` mirror `src/types/cms.ts`.

Other special schemas:
- `SiteSettingsModeRead`: the 5-field subset `PortfolioContext.tsx` selects.
- `GameScoreSubmit`:
  - `game_type: Literal['terminal_quest','neon_breakout']`
  - `nickname: constr(strip_whitespace=True, min_length=1, max_length=10)`
  - `score: conint(ge=0)`
- `VisitorCounts`: `{success, count, todayCount}`. It keeps the Edge Function's camelCase keys.
- `ProjectFolderRead` adds `project_count: int`.
- `LoginRequest {email, password}`, `TokenResponse {access_token, token_type, user: AdminUserRead{id,email}}`.
- `ResumeUploadResponse {url, mode}`.

## §7 FastAPI routers: endpoint map (1:1 with current frontend calls)

- `P` = public. `A` = `Depends(require_admin)`.
- Base prefix `/api/v1`.
- Every handler is `async def`, takes `db: AsyncSession = Depends(get_db)`, returns 404 on a missing row, and returns 409 on `IntegrityError` (unique or FK violations).

| Resource / replaces | Endpoint | Auth | Query semantics |
|---|---|---|---|
| **about** `useAboutContent` | `GET /about?mode=` | P | `WHERE mode ORDER BY order_index` |
| | `POST /about` · `PATCH /about/{id}` · `DELETE /about/{id}` | A | |
| **hero** `useHeroContent` | `GET /hero?mode=` · `POST` · `PATCH /{id}` · `DELETE /{id}` | P / A | `ORDER BY order_index` |
| **contact** `useContactContent` | `GET /contact/{mode}` | P | single row, 404 if none |
| | `PUT /contact/{mode}` | A | `INSERT … ON CONFLICT (mode) DO UPDATE` (upsert) |
| **stats** `useStats` · **skills** `useSkills` | `GET ?mode=` · `POST` · `PATCH` · `DELETE` | P / A | `ORDER BY order_index` |
| **services** `useServices` | `GET` · `POST` · `PATCH` · `DELETE` | P / A | `ORDER BY order_index` |
| **socials** `useSocials` | `GET /socials?mode=&enabled_only=` | P | `ORDER BY order_index` |
| | `POST` · `PATCH` · `DELETE` | A | |
| **github-ticker** `useGithubTicker` | `GET /github-ticker/{mode}` | P | returns `null` if none (maybeSingle) |
| | `PATCH /github-ticker/{id}` | A | |
| **education** · **certifications** | `GET` · `POST` · `PATCH` · `DELETE` | P / A | `ORDER BY order_index` (harmless; the frontend re-sorts) |
| **experiences** `useExperience` | `GET /experiences?mode=` · `POST` · `PATCH` · `DELETE` | P / A | unordered; date sorting stays client-side |
| **technical-skills** `useTechnicalSkills` | `GET /technical-skills` | P | `WHERE is_active ORDER BY name` |
| | CRUD | A | new for admin; RLS already allowed it |
| **site-settings** `useSiteSettings` | `GET /site-settings` | P | singleton, full row |
| | `GET /site-settings/modes` | P | 5-column subset for `PortfolioContext` |
| | `PUT /site-settings` | A | upsert singleton: update the first row, insert if the table is empty |
| **project-folders** `useProjectFolders` | `GET /project-folders?include_inactive=` | P (inactive needs A) | one query with `LEFT JOIN (SELECT folder_id, count(*) FROM projects WHERE is_active GROUP BY folder_id)` |
| | `POST` · `PATCH` · `DELETE` | A | |
| | `PUT /project-folders/reorder` (body `ReorderItem[]`) | A | one transaction |
| **projects** `useProjects` | `GET /projects?mode=&include_inactive=` | P (inactive needs A) | `ORDER BY order_index` |
| | `GET /projects/by-slug/{slug}` | P | |
| | `POST` (auto slug + dedupe suffix, same regex as the 2026-02-19 migration) · `PATCH` · `DELETE` | A | |
| **project-image-folders** `useProjectImageFolders` | `GET /projects/{project_id}/image-folders` | P | `ORDER BY order_index` |
| | `POST` · `PATCH /image-folders/{id}` · `DELETE` | A | |
| **magazine** `useMagazine` | `GET /magazine/latest` | P | `WHERE is_published ORDER BY created_at DESC LIMIT 1`, or null |
| | `GET /magazine` | A | all rows, `created_at DESC` |
| | `POST` · `DELETE /{id}` | A | |
| | `POST /magazine/{id}/publish` | A | **one transaction**: unpublish all, then publish this one |
| | `POST /magazine/{id}/unpublish` | A | |
| **game-scores** `useGameScores` + RPC | `GET /game-scores/{game_type}/leaderboard` | P | `ORDER BY score DESC LIMIT 10` |
| | `POST /game-scores` | P | replaces `submit_game_score`; validated insert, returns `{success: true}`; rate-limited per IP (see §8) |
| **visitors** `track-visitor` + `useVisitorCounter` fallback | `POST /visitors/increment` · `GET /visitors` | P | atomic SQL below |
| | `GET /visitors/daily?range=7days\|30days\|all` | A | `VisitorStatsManager`: `WHERE date >= … ORDER BY date` |
| **auth** `authService` | `POST /auth/login` → TokenResponse · `GET /auth/me` → AdminUserRead · `POST /auth/logout` (client drops token) | P / A / A | |
| **resumes** `ResumeManager` | `POST /resumes/{mode}` (multipart, PDF, ≤ 10 MB) | A | delete old R2 object if the URL is on `R2_PUBLIC_BASE`, upload, set `{mode}_resume_url`, all in one request |
| | `DELETE /resumes/{mode}` | A | |
| **stubs (later phase)** | `POST /ai/chat` (P) · `POST /ai/generate-description` (A) · `POST /ai/generate-magazine` (A) · `GET /drive/{test,count,list}` (P) | | 501 until ported |

Representative handler bodies:

```python
# app/services/visitor.py — fixes the read-then-write race in track-visitor
from sqlalchemy import text

async def increment(db: AsyncSession) -> tuple[int, int]:
    total = (await db.execute(text(
        "UPDATE visitor_stats SET view_count = view_count + 1, last_updated = now() "
        "WHERE id = (SELECT id FROM visitor_stats LIMIT 1) RETURNING view_count"
    ))).scalar_one_or_none()
    if total is None:
        total = (await db.execute(text(
            "INSERT INTO visitor_stats (view_count) VALUES (1) RETURNING view_count"))).scalar_one()
    today = (await db.execute(text(
        "INSERT INTO visitor_daily_stats (date, view_count) VALUES ((now() AT TIME ZONE 'UTC')::date, 1) "
        "ON CONFLICT (date) DO UPDATE SET view_count = visitor_daily_stats.view_count + 1 "
        "RETURNING view_count"))).scalar_one()
    await db.commit()
    return total, today
```

On timezones: the Edge Function takes "today" as the UTC date (`new Date().toISOString()`). The SQL computes `(now() AT TIME ZONE 'UTC')::date` explicitly rather than relying on `CURRENT_DATE`. A session time zone isn't dependable through Neon's transaction-mode pooler, because the setting doesn't persist between transactions.

```python
# app/api/routers/magazine.py — atomic publish
@router.post("/{issue_id}/publish", response_model=MagazineIssueRead, dependencies=[Depends(require_admin)])
async def publish_issue(issue_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> MagazineIssue:
    issue = await db.get(MagazineIssue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    await db.execute(update(MagazineIssue).where(MagazineIssue.is_published.is_(True)).values(is_published=False))
    issue.is_published = True
    await db.commit()       # both statements commit together; an exception rolls both back
    await db.refresh(issue)
    return issue
```

```python
# generic CRUD pattern, shown once for stats; every resource router follows it
@router.patch("/{item_id}", response_model=StatRead, dependencies=[Depends(require_admin)])
async def update_stat(item_id: uuid.UUID, payload: StatUpdate, db: AsyncSession = Depends(get_db)) -> Stat:
    row = await db.get(Stat, item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Stat not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Constraint violation") from exc
    await db.refresh(row)
    return row
```

## §8 Auth and R2

**Auth**
- `POST /auth/login` looks up `admin_users` by email and verifies with `pwdlib` argon2 in constant time. On any failure it returns the same 401.
- It issues a PyJWT HS256 token (`sub=id`, `email`, `exp` = `JWT_EXPIRE_MINUTES`, default 60).
- `require_admin` decodes the bearer token, loads the user, and rejects inactive users.
- `scripts/create_admin.py` seeds the first admin. Supabase password hashes aren't migrated, so the admin sets a new password.
- CORS is limited to `CORS_ORIGINS` (the Vite dev URL and the Vercel domain).
- Rate limiting on `/auth/login` and `POST /game-scores` is noted as a follow-up (for example `slowapi`); it isn't in the baseline.

**R2** (`app/services/storage_r2.py`)
- An `aioboto3` S3 client with `endpoint_url=https://<account>.r2.cloudflarestorage.com`.
- `put_object(key, bytes, content_type, cache_control="max-age=3600")` and `delete_object(key)`.
- Public URL = `R2_PUBLIC_BASE/key`.
- Every call is awaited, with explicit try/except that maps to 502 on storage failure.
- Uploads validate the `%PDF` magic bytes, not only the content-type.

## §9 Alembic

- `alembic init -t async alembic`
- `env.py` imports `app.models` and uses `settings.database_url_direct` (the non-pooler Neon URL).
- The `0001_baseline` revision comes from `alembic revision --autogenerate`. It is then hand-edited to add what autogenerate misses:
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto` (Neon already has `gen_random_uuid` on PG13+, but this is harmless)
  - the `update_updated_at_column()` function
  - BEFORE UPDATE triggers on **every** table with `updated_at` (ORM `onupdate` covers ORM writes; the trigger covers raw SQL)
  - the `DESC` expression indexes, if autogenerate renders them wrongly
- Review the generated SQL with `alembic upgrade head --sql` before applying.

## §10 Data migration runbook

1. `pg_dump --schema-only` Supabase and resolve every §5 VERIFY row. Update the models before generating `0001`.
2. `alembic upgrade head` on a Neon branch (not main).
3. `scripts/copy_supabase_data.py` (async):
   - Streams each table from the Supabase direct URL to Neon in FK order: `project_folders` → `projects` → `project_image_folders`, then everything else.
   - Preserves UUIDs and timestamps.
   - Disables triggers during the copy (`SET session_replication_role = replica`) so `updated_at` isn't rewritten.
   - Alternative: `pg_dump --data-only --table=…` piped to `psql`.
4. Check row counts per table, source against target.
5. Copy the `resumes` bucket and the `Pictures` asset to R2. Rewrite `site_settings.*resume_url` and the `index.html` URL to the R2 public base.
6. Create the admin with `scripts/create_admin.py`.

## §11 Frontend cutover order (later, separately planned phase)

Add `src/services/apiClient.ts`: fetch wrapper, bearer token in localStorage, and explicit loading and error handling. Then swap one hook at a time, keeping the return shapes:
1. Read-only public: `useStats`, `useSkills`, `useServices`, `useSocials`, `useGithubTicker`, `useTechnicalSkills`
2. `useSiteSettings` + `PortfolioContext`. Keep `modeSettingsLoaded`, the visible-pages logic and the localStorage fallback.
3. `useVisitorCounter` and `useGameScores`
4. Projects, folders, image folders, magazine
5. Auth (`authService`, `ProtectedRoute`), then admin writes, then `ResumeManager`
6. Regenerate `types.ts` equivalents from the OpenAPI schema (`openapi-typescript`)
7. Remove the Supabase clients only after everything above is verified

## §12 Verification checklist

- `alembic upgrade head` succeeds on an empty Neon branch, and `alembic check` reports no drift.
- The schema diff between `pg_dump --schema-only` of Neon and Supabase shows only intended differences (no RLS, new `admin_users`).
- Row counts match per table after the copy.
- `uvicorn main:app --reload` starts, and `/docs` lists every endpoint in §7.
- pytest + httpx `AsyncClient` against a Neon test branch:
  - CRUD round-trip per resource
  - 401 on admin routes without a token
  - `magazine/latest` hides unpublished issues
  - duplicate slug returns 409
  - folder delete sets `projects.folder_id` to NULL
  - project delete cascades to image folders
  - 50 concurrent `POST /visitors/increment` calls add exactly 50
  - publish leaves exactly one published issue
  - nickname over 10 characters returns 422
- Manual check: run `bun run dev` with one hook switched to the API and confirm the UI matches the Supabase-backed version.

## §13 Post-migration sanity scan (2026-09-14)

The core cutover (§4 models, §7 admin CRUD, §11 hook-by-hook frontend swap) is complete and verified: all 21 tables are declared under `backend/app/models/` with SQLAlchemy 2.0 `Mapped[]` columns and the `UUIDPk`/`Timestamps*` mixins (zero legacy `Column()` usage), all 23 routers are registered in `main.py` behind `/api/v1` and render cleanly through `/openapi.json` (54 paths, 84 operations), `CORS_ORIGINS` covers the real Vite dev port (8080) plus Vite's default (5173), and `apiClient.ts` defaults to `http://localhost:8000/api/v1`.

A first pass found 5 files outside `src/hooks/` still on Supabase, split into a genuine backend gap and 4 items the plan had deliberately deferred (§7's "stubs (later phase)" row). All 5 are now closed:

**`GET /visitors/daily?range=` (was a real gap — documented in §7 but never built):**
- Added `backend/app/services/visitor.get_daily_stats` + the route in `visitors.py`, `VisitorDailyStatsRead` schema, 4 new tests.
- `src/components/admin/VisitorStatsManager.tsx` now calls it via `apiClient` instead of `supabase.from('visitor_daily_stats')`.

**AI generation + chat (`generate-description`, `generate-magazine`, `portfolio-chat`) — ported to FastAPI as real routes, not stubs:**
- `backend/app/services/ai_gateway.py`: thin OpenAI-compatible client for `https://ai.gateway.lovable.dev` (the same gateway the Edge Functions called), reading `LOVABLE_API_KEY` from settings. The key is intentionally left blank in `backend/.env` — every route built on this returns a clean `503 "AI service not configured"` until a real key is set, rather than crashing.
- `backend/app/services/ai_content.py`: ports each function's actual logic — `generate_description`'s prompt builder, `generate_magazine`'s DB reads (now our own async ORM instead of a Supabase service-role client) + tool-calling schema, and `portfolio-chat`'s full context assembly + input sanitization + streaming.
- Routes: `POST /ai/generate-description` (admin), `POST /ai/generate-magazine` (admin), `POST /ai/chat` (public, streams `text/event-stream`) — all registered in `app/api/routers/ai.py`.
- One deliberate behavior change: the chat's resume-download button used to read the legacy `site_settings.resume_url`, which is a dead Supabase URL post-migration (§1 finding: this column is LEGACY). It now reads the mode-specific `professional_resume_url`/`creative_resume_url` instead.
- Frontend: `DescriptionGenerator.tsx`, `MagazineManager.tsx` now call `apiClient.post('/ai/...')` instead of `supabase.functions.invoke(...)`; `ChatbotDrawer.tsx` fetches `${API_BASE_URL}/ai/chat` (no Supabase anon-key header needed — the route is public).
- 6 new tests cover admin gating, validation, and the not-configured 503 path; the actual generation calls can't be tested end-to-end without a real `LOVABLE_API_KEY`.

**Google Drive proxy (`google-drive-proxy`) — ported and live, not just stubbed:**
- `backend/app/services/google_drive.py` + `app/api/routers/drive.py`: `GET /drive/{test,count,list}`, public, reading `GOOGLE_DRIVE_API_KEY` from settings.
- Unlike the AI routes, a real key was supplied and is set in `backend/.env` (gitignored, never committed) — these 3 routes were verified against the live, public Google Drive API, not just unit-tested.
- `src/services/googleDriveService.ts` now calls `apiClient.get('/drive/...')` instead of `fetch`-ing the Supabase Edge Function URL directly.

**`useVisitorCounter.ts`'s Supabase fallback — removed, not kept:**
- The plan originally called this out as a deliberate last-resort fallback (§11 step 3). Once every other Supabase consumer was gone, keeping one hook on the old client for an edge case stopped being worth the dependency. The fallback branch (direct `supabase.from('visitor_stats'/'visitor_daily_stats')` reads) was deleted; a failed `apiClient` call now just logs and leaves the counters at 0, same as any other transient API failure elsewhere in the app.

**Full removal, not just rerouting:**
- `src/integrations/supabase/` (client + generated `types.ts`) and `src/utils/supabase.ts` deleted — nothing in `src/` imports them anymore.
- `@supabase/supabase-js` removed from `package.json` / the lockfile.
- `supabase/migrations/` and `supabase/functions/*/index.ts` (the historical SQL and Edge Function source) are kept on disk per this document's own §10/§12 guidance and CLAUDE.md — they're reference material for what was ported, not live dependencies; nothing in the running app reads them.

`useGameScores.ts`'s `useLocalHighScore` remains pure `localStorage` by design — it was never a Supabase dependency.

**Final state:** 117/117 backend tests pass (up from 103), `tsc --noEmit` and lint clean (no new issues), zero `supabase` imports anywhere under `src/`.

---

## Appendix A: complete Pydantic v2 schemas

Rules applied throughout:
- **Required vs optional** in `*Create` follows the `Insert` type in `types.ts`: a non-optional key is required.
- **`*Update`** makes every field optional, sets `extra="forbid"`, and is applied with `exclude_unset=True`.
- **`*Read`** adds `id` plus the timestamps, with the same nullability as the model.
- **`Mode`**, **`ORMModel`** and **`ReorderItem`** come from `app/schemas/common.py`. The `Project*` schemas are in §6.

### A.1 `app/schemas/content.py`

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Mode, ORMModel

_UPDATE = ConfigDict(extra="forbid")

# about_content
class AboutContentCreate(BaseModel):
    mode: Mode
    content: str
    order_index: int = 0
    section_title: str | None = None

class AboutContentUpdate(BaseModel):
    model_config = _UPDATE
    mode: Mode | None = None
    content: str | None = None
    order_index: int | None = None
    section_title: str | None = None

class AboutContentRead(AboutContentCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# hero_content
class HeroContentCreate(BaseModel):
    mode: Mode
    name: str
    title: str
    greeting: str
    description: str
    cta_text: str
    order_index: int = 0
    cta_link: str | None = None
    animated_titles: list[str] | None = None
    animation_speed: int | None = None
    animation_pause_duration: int | None = None
    gradient_overlay_opacity: float | None = None
    background_image_url: str | None = None
    profile_photo_url: str | None = None

class HeroContentUpdate(BaseModel):
    model_config = _UPDATE
    mode: Mode | None = None
    name: str | None = None
    title: str | None = None
    greeting: str | None = None
    description: str | None = None
    cta_text: str | None = None
    order_index: int | None = None
    cta_link: str | None = None
    animated_titles: list[str] | None = None
    animation_speed: int | None = None
    animation_pause_duration: int | None = None
    gradient_overlay_opacity: float | None = None
    background_image_url: str | None = None
    profile_photo_url: str | None = None

class HeroContentRead(HeroContentCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# contact_content — PUT /contact/{mode} upsert; mode comes from the path
class ContactContentUpsert(BaseModel):
    model_config = _UPDATE
    title: str
    email: str
    subtitle: str | None = None
    phone: str | None = None
    location: str | None = None
    services: list[str] | None = None

class ContactContentRead(ContactContentUpsert, ORMModel):
    id: uuid.UUID
    mode: Mode
    created_at: datetime | None
    updated_at: datetime | None

# stats
class StatCreate(BaseModel):
    mode: Mode
    label: str
    value: str
    order_index: int = 0

class StatUpdate(BaseModel):
    model_config = _UPDATE
    mode: Mode | None = None
    label: str | None = None
    value: str | None = None
    order_index: int | None = None

class StatRead(StatCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# skills
class SkillCreate(BaseModel):
    mode: Mode
    category: str
    icon: str
    color: str
    skills: list[str]
    order_index: int = 0

class SkillUpdate(BaseModel):
    model_config = _UPDATE
    mode: Mode | None = None
    category: str | None = None
    icon: str | None = None
    color: str | None = None
    skills: list[str] | None = None
    order_index: int | None = None

class SkillRead(SkillCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# services
class ServiceCreate(BaseModel):
    title: str
    description: str
    features: list[str]
    order_index: int = 0

class ServiceUpdate(BaseModel):
    model_config = _UPDATE
    title: str | None = None
    description: str | None = None
    features: list[str] | None = None
    order_index: int | None = None

class ServiceRead(ServiceCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

# socials
class SocialCreate(BaseModel):
    name: str
    icon: str
    url: str
    mode: Mode = "professional"
    enabled: bool | None = None
    order_index: int | None = None

class SocialUpdate(BaseModel):
    model_config = _UPDATE
    name: str | None = None
    icon: str | None = None
    url: str | None = None
    mode: Mode | None = None
    enabled: bool | None = None
    order_index: int | None = None

class SocialRead(SocialCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None

# github_ticker — one row per mode; only text/url are editable (useGithubTicker)
class GithubTickerUpdate(BaseModel):
    model_config = _UPDATE
    text: str | None = None
    url: str | None = None

class GithubTickerRead(ORMModel):
    id: uuid.UUID
    mode: Mode
    text: str
    url: str
    created_at: datetime
    updated_at: datetime
```

### A.2 `app/schemas/academic.py`

```python
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Mode, ORMModel

_UPDATE = ConfigDict(extra="forbid")

# education
class EducationCreate(BaseModel):
    degree: str
    institution: str
    location: str
    period: str
    description: str
    achievements: list[str] = []
    order_index: int = 0

class EducationUpdate(BaseModel):
    model_config = _UPDATE
    degree: str | None = None
    institution: str | None = None
    location: str | None = None
    period: str | None = None
    description: str | None = None
    achievements: list[str] | None = None
    order_index: int | None = None

class EducationRead(EducationCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None

# certifications
class CertificationCreate(BaseModel):
    name: str
    issuer: str
    description: str
    date: str
    featured: bool | None = None
    credential_id: str | None = None
    credential_url: str | None = None
    order_index: int = 0

class CertificationUpdate(BaseModel):
    model_config = _UPDATE
    name: str | None = None
    issuer: str | None = None
    description: str | None = None
    date: str | None = None
    featured: bool | None = None
    credential_id: str | None = None
    credential_url: str | None = None
    order_index: int | None = None

class CertificationRead(CertificationCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None

# experiences
DateType = Literal["range", "single"]

class ExperienceCreate(BaseModel):
    title: str
    company: str
    location: str
    period: str
    description: str
    mode: Mode
    achievements: list[str] | None = None
    order_index: int | None = None
    experience_type: str | None = None
    date_type: DateType | None = None
    event_date: str | None = None
    role: str | None = None
    event_images: list[str] | None = None
    certificate_url: str | None = None
    certificate_drive_id: str | None = None

class ExperienceUpdate(BaseModel):
    model_config = _UPDATE
    title: str | None = None
    company: str | None = None
    location: str | None = None
    period: str | None = None
    description: str | None = None
    mode: Mode | None = None
    achievements: list[str] | None = None
    order_index: int | None = None
    experience_type: str | None = None
    date_type: DateType | None = None
    event_date: str | None = None
    role: str | None = None
    event_images: list[str] | None = None
    certificate_url: str | None = None
    certificate_drive_id: str | None = None

class ExperienceRead(ExperienceCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None

# technical_skills
class TechnicalSkillCreate(BaseModel):
    name: str
    category: str
    color: str | None = None
    icon_url: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    position_z: float | None = None
    is_active: bool | None = None

class TechnicalSkillUpdate(BaseModel):
    model_config = _UPDATE
    name: str | None = None
    category: str | None = None
    color: str | None = None
    icon_url: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    position_z: float | None = None
    is_active: bool | None = None

class TechnicalSkillRead(TechnicalSkillCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None
```

### A.3 `app/schemas/site.py`

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Mode, ORMModel

class SiteSettingsFields(BaseModel):
    site_name: str | None = None                      # LEGACY; NOT NULL in DB
    logo_url: str | None = None                       # LEGACY
    resume_url: str | None = None                     # LEGACY
    professional_site_name: str | None = None
    professional_logo_url: str | None = None
    professional_mode_enabled: bool | None = None
    professional_resume_url: str | None = None
    professional_visible_pages: list[str] | None = None
    creative_site_name: str | None = None
    creative_logo_url: str | None = None
    creative_mode_enabled: bool | None = None
    creative_resume_url: str | None = None
    creative_visible_pages: list[str] | None = None
    mode_toggle_pages: list[str] | None = None
    default_mode: Mode | None = None
    academic_default_view: str | None = None
    projects_default_view: str | None = None
    visitor_counter_enabled: bool | None = None
    show_total_visitors: bool | None = None
    show_daily_visitors: bool | None = None
    chatbot_enabled: bool | None = None
    chatbot_name: str | None = None
    chatbot_welcome_message: str | None = None
    chatbot_default_state: str | None = None

class SiteSettingsUpsert(SiteSettingsFields):
    """PUT /site-settings. Updates the singleton row with the fields that were sent.
    If the table is empty the router inserts a row, and `site_name` is then required
    (422 otherwise)."""
    model_config = ConfigDict(extra="ignore")     # useSiteSettings also sends id/created_at

class SiteSettingsRead(SiteSettingsFields, ORMModel):
    id: uuid.UUID
    site_name: str
    created_at: datetime
    updated_at: datetime

class SiteSettingsModeRead(ORMModel):             # PortfolioContext.tsx subset
    professional_mode_enabled: bool | None
    creative_mode_enabled: bool | None
    default_mode: str | None
    professional_visible_pages: list[str] | None
    creative_visible_pages: list[str] | None
```

### A.4 `app/schemas/projects.py` (folders and image folders; `Project*` is in §6)

```python
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Mode, ORMModel

_UPDATE = ConfigDict(extra="forbid")

# project_folders
class ProjectFolderCreate(BaseModel):
    name: str
    mode: Mode
    description: str | None = None
    cover_image_drive_id: str | None = None
    order_index: int = 0
    is_active: bool | None = None

class ProjectFolderUpdate(BaseModel):
    model_config = _UPDATE
    name: str | None = None
    mode: Mode | None = None
    description: str | None = None
    cover_image_drive_id: str | None = None
    order_index: int | None = None
    is_active: bool | None = None

class ProjectFolderRead(ProjectFolderCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    project_count: int = 0          # computed: active projects in this folder

# project_image_folders
class ProjectImageFolderCreate(BaseModel):
    project_id: uuid.UUID
    name: str
    description: str | None = None
    media_type: str | None = None   # VERIFY allowed values (probably 'images' | 'video')
    images: list[str] | None = None
    video_url: str | None = None
    video_thumbnail: str | None = None
    order_index: int | None = None

class ProjectImageFolderUpdate(BaseModel):
    model_config = _UPDATE
    name: str | None = None
    description: str | None = None
    media_type: str | None = None
    images: list[str] | None = None
    video_url: str | None = None
    video_thumbnail: str | None = None
    order_index: int | None = None

class ProjectImageFolderRead(ProjectImageFolderCreate, ORMModel):
    id: uuid.UUID
    created_at: datetime | None
    updated_at: datetime | None
```

### A.5 `app/schemas/magazine.py`

```python
import uuid
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict
from app.schemas.common import ORMModel

class MagazineArticle(BaseModel):
    project_id: str
    headline: str
    pull_quote: str
    body: str
    layout: Literal["split_left", "split_right", "full_bleed"]
    image_drive_id: str | None = None

class MagazineCover(BaseModel):
    headline: str
    subhead: str
    cover_image_drive_id: str | None = None

class MagazineSection(BaseModel):
    title: str
    body: str

class MagazineContent(BaseModel):
    title: str
    cover: MagazineCover
    editors_note: MagazineSection
    articles: list[MagazineArticle]
    closing: MagazineSection

class MagazineIssueCreate(BaseModel):
    title: str
    content: MagazineContent
    mode: str = "creative"
    is_published: bool | None = False
    cover_headline: str | None = None
    cover_subhead: str | None = None
    project_ids: list[str] = []

class MagazineIssueUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = None
    content: MagazineContent | None = None
    mode: str | None = None
    cover_headline: str | None = None
    cover_subhead: str | None = None
    project_ids: list[str] | None = None
    # is_published is changed only through /publish and /unpublish

class MagazineIssueRead(ORMModel):
    id: uuid.UUID
    title: str
    # Existing rows may hold the DB default '{}', so reads also accept an unstructured dict
    content: MagazineContent | dict[str, Any]
    mode: str
    is_published: bool | None
    cover_headline: str | None
    cover_subhead: str | None
    project_ids: list[str] | None
    created_at: datetime
    updated_at: datetime
```

### A.6 `app/schemas/analytics.py`

```python
import uuid
from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import BaseModel, Field, StringConstraints
from app.schemas.common import ORMModel

GameType = Literal["terminal_quest", "neon_breakout"]

class VisitorCounts(BaseModel):          # keeps the track-visitor JSON contract
    success: bool = True
    count: int
    todayCount: int

class VisitorDailyRead(ORMModel):
    id: uuid.UUID
    date: date
    view_count: int
    created_at: datetime

class GameScoreSubmit(BaseModel):        # replaces submit_game_score(p_game_type, p_nickname, p_score)
    game_type: GameType
    nickname: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]
    score: Annotated[int, Field(ge=0)]

class GameScoreSubmitResult(BaseModel):
    success: bool

class GameScoreRead(ORMModel):
    id: uuid.UUID
    game_type: str
    nickname: str
    score: int
    created_at: datetime | None
```

### A.7 `app/schemas/auth.py` and `app/schemas/storage.py`

```python
import uuid
from pydantic import BaseModel, EmailStr   # EmailStr needs pydantic[email]
from app.schemas.common import Mode, ORMModel

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminUserRead(ORMModel):           # same shape as AdminUser in src/services/authService.ts
    id: uuid.UUID
    email: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminUserRead

class ResumeUploadResponse(BaseModel):
    mode: Mode
    url: str
```

---

## Appendix B: source traceability

| Claim in this document | Evidence |
|---|---|
| Column lists, nullability, insert-optionality | `src/integrations/supabase/types.ts` (`Row` / `Insert` per table) |
| Defaults, constraints, indexes, FKs, trigger | `supabase/migrations/*.sql` (42 files, 2025-12-19 → 2026-02-19) |
| `contact_content.mode` UNIQUE | `src/hooks/useContactContent.ts` (`upsert … onConflict: 'mode'`) |
| Singleton `site_settings` | migration `20251225181411_…` (dedupe) + `useSiteSettings.ts` (`limit(1)` upsert) |
| Endpoint filters and ordering | `src/hooks/use*.ts`, `src/contexts/PortfolioContext.tsx`, `src/components/admin/VisitorStatsManager.tsx` |
| Visitor semantics | `supabase/functions/track-visitor/index.ts`, `src/hooks/useVisitorCounter.ts` (once per browser session) |
| Game score contract | `src/hooks/useGameScores.ts` (`rpc('submit_game_score')`, top 10 by score) |
| Resume upload rules | `src/components/admin/ResumeManager.tsx` |
| JSONB shapes | `src/types/cms.ts` (`CropPosition`, `ProjectLink`), `src/types/magazine.ts` |
| Admin user contract | `src/services/authService.ts` |
| Edge Function auth posture | `supabase/config.toml` (`verify_jwt = false` on all 5) |
