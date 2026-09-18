# app/models/content.py
#
# Column types, lengths, defaults and CHECK constraints below are taken from
# the real production DDL in db_cluster-26-07-2026@19-41-44.backup (a
# pg_dumpall of the live Supabase project), not inferred from types.ts --
# see MIGRATION_PLAN.md §5 (VERIFY) for what that inference got wrong.
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy import text as sql_text   # GithubTicker has a column named `text` (see below)
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired, TimestampsNullable, UTC_NOW

MODE_CHECK_VARCHAR = "(mode)::text = ANY (ARRAY['professional'::character varying, 'creative'::character varying]::text[])"

class AboutContent(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "about_content"
    __table_args__ = (CheckConstraint(MODE_CHECK_VARCHAR, name="mode"),)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    section_title: Mapped[str | None] = mapped_column(Text, server_default=text("'About Me'"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Overrides TimestampsRequired's plain now() default -- this table uses
    # timezone('utc', now()) in production. See UTC_NOW in app/db/base.py.
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class HeroContent(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "hero_content"
    __table_args__ = (CheckConstraint(MODE_CHECK_VARCHAR, name="mode"),)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    greeting: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cta_text: Mapped[str] = mapped_column(String(255), nullable=False)
    cta_link: Mapped[str | None] = mapped_column(Text, server_default=text("'/projects'"))
    animated_titles: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'::text[]"))
    animation_speed: Mapped[int | None] = mapped_column(Integer, server_default=text("100"))
    animation_pause_duration: Mapped[int | None] = mapped_column(Integer, server_default=text("2000"))
    gradient_overlay_opacity: Mapped[float | None] = mapped_column(Numeric(3, 2, asdecimal=False), server_default=text("0.7"))
    background_image_url: Mapped[str | None] = mapped_column(Text)
    profile_photo_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class ContactContent(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "contact_content"
    __table_args__ = (
        UniqueConstraint("mode"),  # naming convention derives "contact_content_mode_key", matching production
        CheckConstraint(MODE_CHECK_VARCHAR, name="mode"),
    )
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    location: Mapped[str | None] = mapped_column(String(255))
    services: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=UTC_NOW)
    updated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class Stat(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "stats"
    __table_args__ = (CheckConstraint(MODE_CHECK_VARCHAR, name="mode"),)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class Skill(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "skills"
    __table_args__ = (CheckConstraint(MODE_CHECK_VARCHAR, name="mode"),)
    category: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class Service(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "services"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    features: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))

class Social(UUIDPk, TimestampsNullable, Base):
    # No CHECK constraint on mode and no UPDATE trigger in production --
    # confirmed against the real DDL, not an oversight. useSocials.ts writes
    # updated_at manually, matching the absence of a trigger here.
    __tablename__ = "socials"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    mode: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'professional'"))
    order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))

class GithubTicker(UUIDPk, TimestampsRequired, Base):
    # Also no CHECK constraint and no trigger in production; useGithubTicker.ts
    # sets updated_at manually on every PATCH.
    __tablename__ = "github_ticker"
    __table_args__ = (UniqueConstraint("mode", name="github_ticker_mode_unique"),)
    # The column is named `text`. Inside this class body, that name shadows sqlalchemy.text
    # from the next line on, so use the `sql_text` alias for every default here.
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'professional'"))
    text: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'More Projects on Github'"))
    url: Mapped[str] = mapped_column(Text, nullable=False, server_default=sql_text("'https://github.com'"))
