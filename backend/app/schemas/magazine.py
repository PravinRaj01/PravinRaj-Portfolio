# app/schemas/magazine.py — MIGRATION_PLAN.md Appendix A.5, matching src/types/magazine.ts
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

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


class MagazineIssueRead(ORMModel):
    id: uuid.UUID
    title: str
    # Existing rows may hold the DB default '{}', which won't validate
    # against the strict MagazineContent shape -- reads tolerate that.
    content: MagazineContent | dict[str, Any]
    mode: str
    is_published: bool | None
    cover_headline: str | None
    cover_subhead: str | None
    project_ids: list[str] | None
    created_at: datetime
    updated_at: datetime
