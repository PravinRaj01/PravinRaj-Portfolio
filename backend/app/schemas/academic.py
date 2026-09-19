# app/schemas/academic.py — MIGRATION_PLAN.md Appendix A.2
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Mode, ORMModel

_UPDATE = ConfigDict(extra="forbid")


# education — no mode column; real hook has no .order() call either, but
# ORDER BY order_index is harmless (the frontend re-sorts) and deterministic
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


# certifications — same as education: no mode, real hook has no .order()
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


# experiences — mode is optional (useExperience.ts: `if (mode) ...`);
# genuinely unordered in the real hook, date sorting stays client-side
DateType = Literal["range", "single"]


class ExperienceCreate(BaseModel):
    title: str
    slug: str | None = None      # auto-generated from title when omitted, same as ProjectCreate
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
    slug: str | None = None
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


# technical_skills — no mode; WHERE is_active ORDER BY name
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
