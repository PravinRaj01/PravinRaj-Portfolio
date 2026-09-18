# app/api/routers/github_ticker.py — MIGRATION_PLAN.md §7: GET /github-ticker/{mode}
# Returns null (200), not 404, when absent -- matches Supabase's .maybeSingle().
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import GithubTicker
from app.schemas.common import Mode
from app.schemas.content import GithubTickerRead, GithubTickerUpdate

router = APIRouter(prefix="/github-ticker", tags=["github-ticker"])


@router.get("/{mode}", response_model=GithubTickerRead | None)
async def get_github_ticker(
    mode: Mode, db: Annotated[AsyncSession, Depends(get_db)]
) -> GithubTicker | None:
    result = await db.execute(select(GithubTicker).where(GithubTicker.mode == mode))
    return result.scalar_one_or_none()


# PATCH only, matching useGithubTicker.ts and the real table exactly: it's
# a fixed pair of rows (one per mode), created once by a migration, never
# created or deleted by the app -- only text/url are ever edited.
@router.patch("/{item_id}", response_model=GithubTickerRead, dependencies=[Depends(require_admin)])
async def update_github_ticker(
    item_id: uuid.UUID, payload: GithubTickerUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> GithubTicker:
    row = await db.get(GithubTicker, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row
