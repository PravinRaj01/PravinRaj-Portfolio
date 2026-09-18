# app/schemas/ai.py — MIGRATION_PLAN.md §7 "stubs" row: generate-description,
# generate-magazine, portfolio-chat. Request/response shapes match the
# original Edge Functions' JSON contracts exactly (see
# supabase/functions/{generate-description,generate-magazine,portfolio-chat}
# for the source being ported).
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Mode
from app.schemas.magazine import MagazineContent

EntityType = Literal["project", "experience"]


class DescriptionGenerateData(BaseModel):
    title: str | None = None
    category: str | None = None
    categories: list[str] | None = None
    tags: list[str] | None = None
    positions: list[str] | None = None
    date: str | None = None
    period: str | None = None
    company: str | None = None
    location: str | None = None
    role: str | None = None
    images: list[str] | None = None
    achievements: list[str] | None = None


class DescriptionGenerateRequest(BaseModel):
    entityType: EntityType
    mode: Mode
    data: DescriptionGenerateData
    additionalContext: str | None = None


class DescriptionGenerateResponse(BaseModel):
    description: str
    success: bool = True


class MagazineGenerateRequest(BaseModel):
    project_ids: list[str] | None = None
    theme_hint: str | None = None


class MagazineGenerateResponse(BaseModel):
    title: str
    cover_headline: str
    cover_subhead: str
    content: MagazineContent
    project_ids: list[str]


ChatContentMode = Literal["professional", "creative", "both"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    conversationHistory: list[ChatMessage] | None = None
    contentMode: ChatContentMode = "both"
