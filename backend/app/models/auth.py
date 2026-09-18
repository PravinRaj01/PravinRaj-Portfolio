# app/models/auth.py — NEW (replaces Supabase auth.users)
from datetime import datetime

from sqlalchemy import Boolean, Index, Text, func, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk, TimestampsRequired

class AdminUser(UUIDPk, TimestampsRequired, Base):
    __tablename__ = "admin_users"
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)   # argon2 via pwdlib
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class AdminLoginAttempt(UUIDPk, Base):
    # NEW: backs app/services/login_throttle.py. One row per login attempt
    # (success or failure) -- see MIGRATION_PLAN.md §13 production pass.
    # Deliberately not tied to admin_users by FK: an attempt against a
    # nonexistent email is still worth recording and rate-limiting.
    __tablename__ = "admin_login_attempts"
    email: Mapped[str] = mapped_column(Text, nullable=False)
    ip: Mapped[str] = mapped_column(Text, nullable=False)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


Index("idx_admin_login_attempts_email_created", AdminLoginAttempt.email, AdminLoginAttempt.created_at)
Index("idx_admin_login_attempts_ip_created", AdminLoginAttempt.ip, AdminLoginAttempt.created_at)
