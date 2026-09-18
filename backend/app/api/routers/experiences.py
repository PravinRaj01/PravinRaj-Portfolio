# app/api/routers/experiences.py — MIGRATION_PLAN.md §7: GET /experiences?mode=
# mode is optional (useExperience.ts: `if (mode) ...`). Genuinely unordered
# here -- the real hook has no .order() call; date-based sorting happens
# client-side (getStartDate/sort logic in useExperience.ts).
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.academic import Experience
from app.schemas.academic import ExperienceCreate, ExperienceRead, ExperienceUpdate
from app.schemas.common import Mode

router = APIRouter(prefix="/experiences", tags=["experiences"])


@router.get("", response_model=list[ExperienceRead])
async def list_experiences(
    db: Annotated[AsyncSession, Depends(get_db)], mode: Mode | None = None
) -> list[Experience]:
    stmt = select(Experience)
    if mode is not None:
        stmt = stmt.where(Experience.mode == mode)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=ExperienceRead, dependencies=[Depends(require_admin)])
async def create_experience(
    payload: ExperienceCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Experience:
    row = Experience(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=ExperienceRead, dependencies=[Depends(require_admin)])
async def update_experience(
    item_id: uuid.UUID, payload: ExperienceUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Experience:
    row = await db.get(Experience, item_id)
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
async def delete_experience(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(Experience, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
