# app/models/magazine.py
from sqlalchemy import Boolean, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired

class MagazineIssue(UUIDPk, TimestampsRequired, Base):             # [SQL]
    __tablename__ = "magazine_issues"
    title: Mapped[str] = mapped_column(Text, nullable=False)
    is_published: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'creative'"))
    cover_headline: Mapped[str | None] = mapped_column(Text)
    cover_subhead: Mapped[str | None] = mapped_column(Text)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))  # MagazineContent
    project_ids: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'"))  # text[], not uuid[]; kept 1:1
