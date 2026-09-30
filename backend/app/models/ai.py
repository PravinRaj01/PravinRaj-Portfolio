# app/models/ai.py — backs app/services/chat_throttle.py, the public
# /ai/chat rate limit. One row per accepted chat message. Free-tier Gemini
# and Groq quotas are shared across every visitor, so an unthrottled public
# route could exhaust the day's quota by itself -- same reasoning as
# AdminLoginAttempt (app/models/auth.py), and the same window-count pattern.
from datetime import datetime

from sqlalchemy import Index, Text, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPk


class ChatRequestLog(UUIDPk, Base):
    # Named *Log, not ChatRequest, to not collide with the Pydantic
    # ChatRequest schema in app/schemas/ai.py (both get imported into
    # app/api/routers/ai.py).
    __tablename__ = "ai_chat_requests"
    ip: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


Index("idx_ai_chat_requests_ip_created", ChatRequestLog.ip, ChatRequestLog.created_at)
