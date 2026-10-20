# app/schemas/ai.py — MIGRATION_PLAN.md §7 "stubs" row: generate-description,
# generate-magazine, portfolio-chat. Request/response shapes match the
# original Edge Functions' JSON contracts exactly (see
# supabase/functions/{generate-description,generate-magazine,portfolio-chat}
# for the source being ported).
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Mode
from app.schemas.magazine import MagazineContent
from app.schemas.projects import ProjectLink

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
    # True when the visitor spoke the message (browser speech recognition).
    # Only used to tag the trace, so the admin AI tab can show the voice share.
    viaVoice: bool = False


# --- admin: project draft from a GitHub repository (AI v2, Phase 5) ---------------


class CurrentProject(BaseModel):
    """The saved entry being re-synced. Sent by the client so the endpoint stays
    write-free and read-free: it never looks a project up by id."""

    title: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=3000)
    tags: list[str] = Field(default_factory=list, max_length=30)


class RepoImportRequest(BaseModel):
    repo_url: str = Field(min_length=3, max_length=300)
    mode: Mode
    additionalContext: str | None = Field(default=None, max_length=1000)
    # Set when refreshing an existing project instead of drafting a new one.
    current: CurrentProject | None = None


class ProjectDraft(BaseModel):
    """Shaped like the admin project form's fields, so it can seed the form directly."""

    title: str
    description: str
    # Only on a refresh of an existing project: its current description updated with the repo.
    merged_description: str | None = None
    category: str
    categories: list[str]
    tags: list[str]
    position: str | None = None
    positions: list[str] = Field(default_factory=list)
    project_date: str | None = None
    github_url: str
    live_url: str | None = None
    project_links: list[ProjectLink] = Field(default_factory=list)


class RepoInfo(BaseModel):
    full_name: str
    html_url: str
    description: str | None = None
    language: str | None = None
    languages: str | None = None
    stars: int = 0
    forks: int = 0
    created_at: str | None = None
    pushed_at: str | None = None
    license: str | None = None
    topics: list[str] = Field(default_factory=list)
    archived: bool = False
    is_fork: bool = False
    readme_found: bool = True
    files_considered: int = 0
    manifests: list[str] = Field(default_factory=list)
    tree_truncated: bool = False


class RepoImportResponse(BaseModel):
    draft: ProjectDraft
    highlights: list[str]  # the facts the draft rests on, for the reviewer
    repo: RepoInfo


# --- admin: has a project's repository changed since its last sync? ---------------


RepoSyncState = Literal["never_synced", "up_to_date", "changed", "unavailable"]


class RepoStatus(BaseModel):
    project_id: str
    state: RepoSyncState
    pushed_at: str | None = None  # the repository's latest push, when it could be read
