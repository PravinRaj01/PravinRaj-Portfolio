# app/api/routers/technical_skills.py — MIGRATION_PLAN.md §7: GET /technical-skills | WHERE is_active ORDER BY name
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.academic import TechnicalSkill
from app.schemas.academic import TechnicalSkillCreate, TechnicalSkillRead, TechnicalSkillUpdate

router = APIRouter(prefix="/technical-skills", tags=["technical-skills"])


@router.get("", response_model=list[TechnicalSkillRead])
async def list_technical_skills(db: Annotated[AsyncSession, Depends(get_db)]) -> list[TechnicalSkill]:
    result = await db.execute(
        select(TechnicalSkill).where(TechnicalSkill.is_active.is_(True)).order_by(TechnicalSkill.name)
    )
    return list(result.scalars().all())


# CRUD below: "new for admin" per the plan's endpoint map -- no frontend
# mutation hook exists for this resource yet (useTechnicalSkills.ts is
# read-only), but the plan calls these out explicitly as admin surface to
# add, and RLS already permitted authenticated writes on this table.
@router.post("", response_model=TechnicalSkillRead, dependencies=[Depends(require_admin)])
async def create_technical_skill(
    payload: TechnicalSkillCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> TechnicalSkill:
    row = TechnicalSkill(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=TechnicalSkillRead, dependencies=[Depends(require_admin)])
async def update_technical_skill(
    item_id: uuid.UUID, payload: TechnicalSkillUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> TechnicalSkill:
    row = await db.get(TechnicalSkill, item_id)
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
async def delete_technical_skill(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(TechnicalSkill, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
