# app/schemas/analytics.py — MIGRATION_PLAN.md Appendix A.6
import datetime as dt
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import ORMModel

GameType = Literal["terminal_quest", "neon_breakout"]


class VisitorCounts(BaseModel):          # keeps the track-visitor Edge Function's JSON contract
    success: bool = True
    count: int
    todayCount: int


class VisitorDailyStatsRead(ORMModel):
    id: uuid.UUID
    date: dt.date
    view_count: int
    created_at: datetime | None


class GameScoreSubmit(BaseModel):
    # nickname is intentionally NOT constrained to max_length=10 here: the
    # real submit_game_score RPC sanitizes (truncates + strips to
    # alphanumeric/space, defaults to "Anonymous") rather than rejecting --
    # see app/services/game_scores.py. Rejecting via Pydantic would change
    # behavior (422 instead of a silently-cleaned submission).
    game_type: GameType
    nickname: str
    score: int


class GameScoreSubmitResult(BaseModel):
    success: bool
    nickname: str | None = None
    score: int | None = None
    error: str | None = None


class GameScoreRead(ORMModel):
    id: uuid.UUID
    game_type: str
    nickname: str
    score: int
    created_at: datetime | None
