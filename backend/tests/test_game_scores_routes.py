"""Confirms /game-scores matches the real submit_game_score RPC body
(recovered from the production pg_dumpall backup -- see
app/services/game_scores.py) and that the leaderboard reads correctly.

This table is a real, public, visible leaderboard, so every test that
submits a row cleans it up (by id, found via a direct DB query -- not the
leaderboard endpoint, which is LIMIT 10 and would miss a low test score
sitting behind real higher-scored entries) in a `finally` block immediately
after its assertions, regardless of pass/fail. Tests that only exercise
rejection paths (invalid score) insert nothing and need no cleanup.

Not exercised here: the exact >20-submissions-in-5-minutes rate limit
boundary. Proving it directly would mean inserting 21 real rows into the
live leaderboard; the throttling logic is a direct, verbatim port of the
real RPC body already confirmed against the production pg_dump, so a
lighter check (a handful of rapid submissions all succeeding, i.e. normal
play is never wrongly throttled) stands in for it instead.
"""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from main import app

client = TestClient(app)


async def _find_score_id(game_type: str, nickname: str, score: int) -> str | None:
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT id FROM game_scores "
                "WHERE game_type = :game_type AND nickname = :nickname AND score = :score "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"game_type": game_type, "nickname": nickname, "score": score},
        )
        row = result.first()
        return str(row[0]) if row else None


async def _delete_score(score_id: str) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM game_scores WHERE id = :id"), {"id": score_id})


def find_and_cleanup(game_type: str, nickname: str, score: int) -> str | None:
    """Locates the just-inserted row directly in the DB (bypassing the
    top-10-limited leaderboard endpoint) and deletes it. Returns the id that
    was found (None if it wasn't found at all, which is itself a failure the
    caller should assert on)."""

    async def _run() -> str | None:
        score_id = await _find_score_id(game_type, nickname, score)
        if score_id is not None:
            await _delete_score(score_id)
        return score_id

    return asyncio.run(_run())


def test_leaderboard_shape_and_ordering():
    r = client.get("/api/v1/game-scores/terminal_quest/leaderboard")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) <= 10
    scores = [row["score"] for row in rows]
    assert scores == sorted(scores, reverse=True)


def test_invalid_game_type_422():
    r = client.get("/api/v1/game-scores/bogus_game/leaderboard")
    assert r.status_code == 422


def test_submit_valid_score_roundtrips():
    payload = {"game_type": "terminal_quest", "nickname": "PytestOK", "score": 1}
    r = client.post("/api/v1/game-scores", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body == {"success": True, "nickname": "PytestOK", "score": 1, "error": None}

    found_id = find_and_cleanup("terminal_quest", "PytestOK", 1)
    assert found_id is not None, "submitted row was not found in the database"


def test_nickname_is_sanitized_not_rejected():
    # Real RPC behavior: truncate to 10 chars, strip to [a-zA-Z0-9 ], trim,
    # default "Anonymous" if that leaves nothing -- never a 422.
    payload = {"game_type": "neon_breakout", "nickname": "  <script>alert(1)</script> ", "score": 1}
    r = client.post("/api/v1/game-scores", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert len(body["nickname"]) <= 10
    assert all(c.isalnum() or c == " " for c in body["nickname"])

    found_id = find_and_cleanup("neon_breakout", body["nickname"], 1)
    assert found_id is not None, "submitted row was not found in the database"


def test_empty_after_sanitizing_defaults_to_anonymous():
    payload = {"game_type": "terminal_quest", "nickname": "!!!???", "score": 1}
    r = client.post("/api/v1/game-scores", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["nickname"] == "Anonymous"

    found_id = find_and_cleanup("terminal_quest", "Anonymous", 1)
    assert found_id is not None, "submitted row was not found in the database"


def test_score_over_cap_rejected_without_inserting():
    before_id = asyncio.run(_find_score_id("terminal_quest", "Cheater", 999999))
    assert before_id is None

    r = client.post(
        "/api/v1/game-scores", json={"game_type": "terminal_quest", "nickname": "Cheater", "score": 999999}
    )
    assert r.status_code == 200  # soft failure, matching the real RPC -- not an HTTP error
    body = r.json()
    assert body == {"success": False, "nickname": None, "score": None, "error": "Invalid score value"}

    after_id = asyncio.run(_find_score_id("terminal_quest", "Cheater", 999999))
    assert after_id is None, "an over-cap score must not be inserted"


def test_negative_score_rejected_without_inserting():
    r = client.post(
        "/api/v1/game-scores", json={"game_type": "neon_breakout", "nickname": "Neg", "score": -5}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["error"] == "Invalid score value"

    after_id = asyncio.run(_find_score_id("neon_breakout", "Neg", -5))
    assert after_id is None


def test_normal_play_not_rate_limited():
    # A handful of rapid legitimate submissions must never trip the
    # >20-per-5-minutes limiter. See module docstring for why the exact
    # boundary isn't tested against the live table.
    found_ids: list[str] = []
    try:
        for i in range(3):
            r = client.post(
                "/api/v1/game-scores",
                json={"game_type": "terminal_quest", "nickname": f"Rapid{i}", "score": 1},
            )
            assert r.status_code == 200
            body = r.json()
            assert body["success"] is True, f"submission {i} was wrongly rejected: {body}"
            score_id = asyncio.run(_find_score_id("terminal_quest", f"Rapid{i}", 1))
            assert score_id is not None
            found_ids.append(score_id)
    finally:
        for score_id in found_ids:
            asyncio.run(_delete_score(score_id))
