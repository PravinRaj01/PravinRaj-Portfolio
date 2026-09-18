# app/models/academic.py
#
# Verified against the real production DDL in db_cluster-26-07-2026@19-41-44.backup.
from sqlalchemy import Boolean, CheckConstraint, Index, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsNullable

class Education(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "education"
    degree: Mapped[str] = mapped_column(Text, nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    period: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    achievements: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default=text("'{}'"))
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Certification(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "certifications"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    issuer: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[str] = mapped_column(Text, nullable=False)         # free text e.g. "Mar 2024"
    featured: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    credential_id: Mapped[str | None] = mapped_column(Text)         # NOT NULL dropped 2025-12-25
    credential_url: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

class Experience(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "experiences"
    # Real CHECK constraint (experiences_mode_check), missed in the types.ts-only pass.
    __table_args__ = (
        CheckConstraint("mode = ANY (ARRAY['professional'::text, 'creative'::text])", name="mode"),
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(Text, nullable=False)
    period: Mapped[str] = mapped_column(Text, nullable=False)       # "Mar 2025 - Present"; sorted client-side
    description: Mapped[str] = mapped_column(Text, nullable=False)
    achievements: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'::text[]"))
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    experience_type: Mapped[str | None] = mapped_column(Text, server_default=text("'job'"))
    date_type: Mapped[str | None] = mapped_column(Text, server_default=text("'range'"))  # 'range' | 'single'
    event_date: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(Text)
    event_images: Mapped[list[str] | None] = mapped_column(ARRAY(Text), server_default=text("'{}'::text[]"))
    certificate_url: Mapped[str | None] = mapped_column(Text)
    certificate_drive_id: Mapped[str | None] = mapped_column(Text)

class TechnicalSkill(UUIDPk, TimestampsNullable, Base):
    __tablename__ = "technical_skills"
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7), server_default=text("'#3b82f6'"))
    icon_url: Mapped[str | None] = mapped_column(Text)
    position_x: Mapped[float | None] = mapped_column(Numeric(5, 2, asdecimal=False), server_default=text("0"))
    position_y: Mapped[float | None] = mapped_column(Numeric(5, 2, asdecimal=False), server_default=text("0"))
    position_z: Mapped[float | None] = mapped_column(Numeric(5, 2, asdecimal=False), server_default=text("0"))
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))

# Real indexes, found in the production dump but absent from every migration
# file on disk (created directly through the Lovable UI, like the base tables
# themselves -- see MIGRATION_PLAN.md §1).
Index("idx_certifications_order", Certification.order_index)
Index("idx_education_order", Education.order_index)
