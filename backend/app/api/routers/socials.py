# app/api/routers/socials.py — MIGRATION_PLAN.md §7: GET /socials?mode=&enabled_only= | ORDER BY order_index
# mode is optional here (useSocials.ts: `if (mode) query = query.eq('mode', mode)`),
# unlike about/hero/skills/stats where it's always passed.
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import Social
from app.schemas.common import Mode
from app.schemas.content import SocialCreate, SocialRead, SocialUpdate

router = APIRouter(prefix="/socials", tags=["socials"])


@router.get("", response_model=list[SocialRead])
async def list_socials(
    db: Annotated[AsyncSession, Depends(get_db)],
    mode: Mode | None = None,
    enabled_only: bool = False,
) -> list[Social]:
    stmt = select(Social).order_by(Social.order_index)
    if mode is not None:
        stmt = stmt.where(Social.mode == mode)
    if enabled_only:
        stmt = stmt.where(Social.enabled.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=SocialRead, dependencies=[Depends(require_admin)])
async def create_social(payload: SocialCreate, db: Annotated[AsyncSession, Depends(get_db)]) -> Social:
    row = Social(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=SocialRead, dependencies=[Depends(require_admin)])
async def update_social(
    item_id: uuid.UUID, payload: SocialUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Social:
    row = await db.get(Social, item_id)
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
async def delete_social(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(Social, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
