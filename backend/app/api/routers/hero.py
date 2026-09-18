# app/api/routers/hero.py — MIGRATION_PLAN.md §7 (hero row): GET /hero?mode= | ORDER BY order_index
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import HeroContent
from app.schemas.common import Mode
from app.schemas.content import HeroContentCreate, HeroContentRead, HeroContentUpdate

router = APIRouter(prefix="/hero", tags=["hero"])


@router.get("", response_model=list[HeroContentRead])
async def list_hero_content(
    mode: Mode, db: Annotated[AsyncSession, Depends(get_db)]
) -> list[HeroContent]:
    result = await db.execute(
        select(HeroContent).where(HeroContent.mode == mode).order_by(HeroContent.order_index)
    )
    return list(result.scalars().all())


@router.post("", response_model=HeroContentRead, dependencies=[Depends(require_admin)])
async def create_hero_content(
    payload: HeroContentCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> HeroContent:
    row = HeroContent(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=HeroContentRead, dependencies=[Depends(require_admin)])
async def update_hero_content(
    item_id: uuid.UUID, payload: HeroContentUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> HeroContent:
    row = await db.get(HeroContent, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(row)
    return row


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_hero_content(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    # Backend endpoint exists for completeness/parity with the plan's
    # endpoint map even though the frontend has no delete-hero-content flow
    # today (useHeroContent.ts never had a useDeleteHeroContent hook).
    row = await db.get(HeroContent, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
