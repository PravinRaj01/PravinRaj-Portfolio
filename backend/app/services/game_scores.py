# app/services/game_scores.py — reimplements the real submit_game_score(p_game_type,
# p_nickname, p_score) RPC body, recovered from the production pg_dumpall
# backup (db_cluster-26-07-2026@19-41-44.backup). Its actual logic:
#   - sanitizes the nickname (truncate to 10, strip to [a-zA-Z0-9 ], trim,
#     default "Anonymous" if empty) rather than rejecting a long/dirty one
#   - per-game-type score cap; out-of-range is a soft {"success": false}, not
#     an HTTP error
#   - a GLOBAL rate limit per game_type (>20 submissions in 5 minutes) --
#     despite the original SQL's comment saying "per nickname pattern", the
#     actual query has no nickname filter at all; this reimplementation
#     matches the real query, not the stale comment
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import GameScore
from app.schemas.analytics import GameScoreSubmit, GameScoreSubmitResult

MAX_SCORE_BY_GAME_TYPE = {
    "terminal_quest": 2000,   # 10 challenges * ~150 max points + time bonus
    "neon_breakout": 50000,
}
DEFAULT_MAX_SCORE = 10000

RATE_LIMIT_WINDOW = timedelta(minutes=5)
RATE_LIMIT_MAX_SUBMISSIONS = 20

_NICKNAME_ALLOWED = re.compile(r"[^a-zA-Z0-9 ]")


def sanitize_nickname(raw: str) -> str:
    truncated = raw[:10]
    cleaned = _NICKNAME_ALLOWED.sub("", truncated).strip()
    return cleaned or "Anonymous"


async def submit(db: AsyncSession, payload: GameScoreSubmit) -> GameScoreSubmitResult:
    clean_nickname = sanitize_nickname(payload.nickname)
    max_score = MAX_SCORE_BY_GAME_TYPE.get(payload.game_type, DEFAULT_MAX_SCORE)

    if payload.score < 0 or payload.score > max_score:
        return GameScoreSubmitResult(success=False, error="Invalid score value")

    cutoff = datetime.now(timezone.utc) - RATE_LIMIT_WINDOW
    recent_count = await db.scalar(
        select(func.count())
        .select_from(GameScore)
        .where(GameScore.game_type == payload.game_type, GameScore.created_at > cutoff)
    )
    if (recent_count or 0) > RATE_LIMIT_MAX_SUBMISSIONS:
        return GameScoreSubmitResult(success=False, error="Too many submissions. Please wait a few minutes.")

    db.add(GameScore(nickname=clean_nickname, game_type=payload.game_type, score=payload.score))
    await db.commit()

    return GameScoreSubmitResult(success=True, nickname=clean_nickname, score=payload.score)
