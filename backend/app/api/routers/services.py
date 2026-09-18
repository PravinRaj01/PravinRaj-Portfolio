# app/api/routers/services.py — MIGRATION_PLAN.md §7 (services row): GET /services | ORDER BY order_index
# No mode filter: the services table has no mode column.
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import Service
from app.schemas.content import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=list[ServiceRead])
async def list_services(db: Annotated[AsyncSession, Depends(get_db)]) -> list[Service]:
    result = await db.execute(select(Service).order_by(Service.order_index))
    return list(result.scalars().all())


@router.post("", response_model=ServiceRead, dependencies=[Depends(require_admin)])
async def create_service(payload: ServiceCreate, db: Annotated[AsyncSession, Depends(get_db)]) -> Service:
    row = Service(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=ServiceRead, dependencies=[Depends(require_admin)])
async def update_service(
    item_id: uuid.UUID, payload: ServiceUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Service:
    row = await db.get(Service, item_id)
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
async def delete_service(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(Service, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    await db.delete(row)
    await db.commit()
