# app/models/site.py — singleton row (the 2025-12-25 migration deduplicated it)
#
# Verified against the real production DDL in db_cluster-26-07-2026@19-41-44.backup.
from datetime import datetime

from sqlalchemy import Boolean, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired, UTC_NOW

class SiteSettings(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "site_settings"
    site_name: Mapped[str] = mapped_column(String(255), nullable=False)        # LEGACY (mode-specific below)
    logo_url: Mapped[str | None] = mapped_column(Text)                         # LEGACY
    resume_url: Mapped[str | None] = mapped_column(Text)                       # LEGACY
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
    # Overrides TimestampsRequired's plain now() default -- this table uses
    # timezone('utc', now()) in production, and (confirmed against the real
    # DDL) has no UPDATE trigger: useSiteSettings.ts's upsert relies on the
    # column default only applying on INSERT.
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=UTC_NOW, onupdate=text("timezone('utc'::text, now())"))
