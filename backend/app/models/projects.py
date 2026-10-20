# app/models/projects.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, text
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

class Project(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("slug", name="projects_slug_unique"),
        Index("idx_projects_folder_id", "folder_id"),
        # Real CHECK constraint (projects_mode_check), missed in the types.ts-only pass.
        CheckConstraint("mode = ANY (ARRAY['professional'::text, 'creative'::text])", name="mode"),
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
    featured: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    show_in_recent: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    recent_order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    project_date: Mapped[str | None] = mapped_column(Text)
    date_display: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'month'"))  # 'month' | 'full'
    image_drive_id: Mapped[str | None] = mapped_column(Text)
    image_home_drive_id: Mapped[str | None] = mapped_column(Text)
    image_scroll_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    scroll_speed: Mapped[int | None] = mapped_column(Integer, server_default=text("10000"))
    include_thumbnail_in_gallery: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    gallery_images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    video_url: Mapped[str | None] = mapped_column(Text)
    video_thumbnail_drive_id: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)            # LEGACY-ish; project_links is newer
    live_url: Mapped[str | None] = mapped_column(Text)
    github_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # last sync from the repo
    github_pushed_at: Mapped[str | None] = mapped_column(Text)      # repo's pushed_at (ISO) as of that sync
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

class ProjectImageFolder(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "project_image_folders"
    __table_args__ = (Index("idx_project_image_folders_project_id", "project_id"),)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    media_type: Mapped[str | None] = mapped_column(Text, server_default=text("'images'"))
    images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'::text[]"))
    video_url: Mapped[str | None] = mapped_column(Text)
    video_thumbnail: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    project: Mapped[Project] = relationship(back_populates="image_folders")
