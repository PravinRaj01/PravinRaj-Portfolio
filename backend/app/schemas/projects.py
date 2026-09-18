# app/schemas/projects.py — MIGRATION_PLAN.md §6 (Project* schemas)
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Mode, ORMModel


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


class ProjectCreate(ProjectBase):
    pass


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


# project_folders — MIGRATION_PLAN.md Appendix A.4
class ProjectFolderCreate(BaseModel):
    name: str
    mode: Mode
    description: str | None = None
    cover_image_drive_id: str | None = None
    order_index: int = 0
    is_active: bool | None = None


class ProjectFolderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
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
    media_type: str | None = None
    images: list[str] | None = None
    video_url: str | None = None
    video_thumbnail: str | None = None
    order_index: int | None = None


class ProjectImageFolderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
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
