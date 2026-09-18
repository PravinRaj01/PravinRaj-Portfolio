# app/api/routers/education.py — MIGRATION_PLAN.md §7: GET /education | ORDER BY order_index
# No mode column. The real hook has no .order() call at all; ordering by
# order_index is harmless (the frontend re-sorts) and gives deterministic output.
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.academic import Education
from app.schemas.academic import EducationCreate, EducationRead, EducationUpdate

router = APIRouter(prefix="/education", tags=["education"])


@router.get("", response_model=list[EducationRead])
async def list_education(db: Annotated[AsyncSession, Depends(get_db)]) -> list[Education]:
    result = await db.execute(select(Education).order_by(Education.order_index))
    return list(result.scalars().all())


@router.post("", response_model=EducationRead, dependencies=[Depends(require_admin)])
async def create_education(
    payload: EducationCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Education:
    row = Education(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=EducationRead, dependencies=[Depends(require_admin)])
async def update_education(
    item_id: uuid.UUID, payload: EducationUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Education:
    row = await db.get(Education, item_id)
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
async def delete_education(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(Education, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
