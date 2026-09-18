# app/api/routers/about.py — MIGRATION_PLAN.md §7 (about row): GET /about?mode= | WHERE mode ORDER BY order_index
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import AboutContent
from app.schemas.common import Mode
from app.schemas.content import AboutContentCreate, AboutContentRead, AboutContentUpdate

router = APIRouter(prefix="/about", tags=["about"])


@router.get("", response_model=list[AboutContentRead])
async def list_about_content(
    mode: Mode, db: Annotated[AsyncSession, Depends(get_db)]
) -> list[AboutContent]:
    result = await db.execute(
        select(AboutContent).where(AboutContent.mode == mode).order_by(AboutContent.order_index)
    )
    return list(result.scalars().all())


@router.post("", response_model=AboutContentRead, dependencies=[Depends(require_admin)])
async def create_about_content(
    payload: AboutContentCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> AboutContent:
    row = AboutContent(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=AboutContentRead, dependencies=[Depends(require_admin)])
async def update_about_content(
    item_id: uuid.UUID, payload: AboutContentUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> AboutContent:
    row = await db.get(AboutContent, item_id)
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
async def delete_about_content(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(AboutContent, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
