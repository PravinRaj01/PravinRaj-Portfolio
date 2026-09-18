# app/schemas/site.py — MIGRATION_PLAN.md Appendix A.3
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
    """PUT /site-settings (not yet wired to a route -- useUpdateSiteSettings
    still goes through Supabase). Updates the singleton row with the fields
    that were sent; if the table is empty the router would insert a row, and
    site_name is then required (422 otherwise)."""
    model_config = ConfigDict(extra="ignore")     # useSiteSettings also sends id/created_at


class SiteSettingsRead(SiteSettingsFields, ORMModel):
    id: uuid.UUID
    site_name: str
    created_at: datetime
    updated_at: datetime


class SiteSettingsModeRead(ORMModel):             # PortfolioContext.tsx's exact 5-column select
    professional_mode_enabled: bool | None
    creative_mode_enabled: bool | None
    default_mode: str | None
    professional_visible_pages: list[str] | None
    creative_visible_pages: list[str] | None
