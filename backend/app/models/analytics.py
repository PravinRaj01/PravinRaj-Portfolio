# app/models/analytics.py
import datetime as dt
from sqlalchemy import TIMESTAMP, Date, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPk

class VisitorStats(UUIDPk, Base):                                  # [SQL] singleton counter
    __tablename__ = "visitor_stats"
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    last_updated: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

class VisitorDailyStats(UUIDPk, Base):                             # [SQL]
    __tablename__ = "visitor_daily_stats"
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, unique=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

class GameScore(UUIDPk, Base):                                     # [SQL]
    __tablename__ = "game_scores"
    nickname: Mapped[str] = mapped_column(String(10), nullable=False)
    game_type: Mapped[str] = mapped_column(String(20), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[dt.datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

# DESC indexes are declared after the classes, bound to real columns. An Index built only
# from text() has no column to attach it to a table, and Alembic autogenerate renders it badly.
Index("idx_visitor_daily_stats_date", VisitorDailyStats.date.desc())
Index("idx_game_scores_game_type_score", GameScore.game_type, GameScore.score.desc())
