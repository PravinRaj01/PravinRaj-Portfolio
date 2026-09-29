# app/schemas/content.py — MIGRATION_PLAN.md Appendix A.1
import uuid
from datetime import date, datetime

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
    birth_date: date | None = None
    fun_facts: list[str] | None = None


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
    birth_date: date | None = None
    fun_facts: list[str] | None = None


class HeroContentRead(HeroContentCreate, ORMModel):
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


# contact_content — GET /contact/{mode} single row, 404 if none;
# PUT /contact/{mode} upsert (mode comes from the path, not the body)
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


# socials — mode is optional in the real hook (useSocials.ts: `if (mode) ...`),
# unlike about/hero/skills/stats where it's always passed
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


# github_ticker — one row per mode; GET /github-ticker/{mode} returns null
# (not 404) when absent, matching Supabase's .maybeSingle(); only text/url
# are editable (useGithubTicker.ts)
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
