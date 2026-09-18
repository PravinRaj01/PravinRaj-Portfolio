# app/api/routers/game_scores.py — MIGRATION_PLAN.md §7
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.analytics import GameScore
from app.schemas.analytics import GameScoreRead, GameScoreSubmit, GameScoreSubmitResult, GameType
from app.services import game_scores as game_scores_service

router = APIRouter(prefix="/game-scores", tags=["game-scores"])


@router.get("/{game_type}/leaderboard", response_model=list[GameScoreRead])
async def get_leaderboard(
    game_type: GameType, db: Annotated[AsyncSession, Depends(get_db)]
) -> list[GameScore]:
    result = await db.execute(
        select(GameScore)
        .where(GameScore.game_type == game_type)
        .order_by(GameScore.score.desc())
        .limit(10)
    )
    return list(result.scalars().all())


@router.post("", response_model=GameScoreSubmitResult)
async def submit_game_score(
    payload: GameScoreSubmit, db: Annotated[AsyncSession, Depends(get_db)]
) -> GameScoreSubmitResult:
    # Matches the real submit_game_score RPC: invalid score / rate-limited
    # submissions return 200 with {success: false, error: "..."}, not an
    # HTTP error status -- see app/services/game_scores.py.
    return await game_scores_service.submit(db, payload)
