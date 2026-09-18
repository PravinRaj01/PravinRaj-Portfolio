# app/api/routers/contact.py — MIGRATION_PLAN.md §7: GET /contact/{mode} | single row, 404 if none
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.content import ContactContent
from app.schemas.common import Mode
from app.schemas.content import ContactContentRead, ContactContentUpsert

router = APIRouter(prefix="/contact", tags=["contact"])


@router.get("/{mode}", response_model=ContactContentRead)
async def get_contact_content(mode: Mode, db: Annotated[AsyncSession, Depends(get_db)]) -> ContactContent:
    result = await db.execute(select(ContactContent).where(ContactContent.mode == mode))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact content not found")
    return row


@router.put("/{mode}", response_model=ContactContentRead, dependencies=[Depends(require_admin)])
async def upsert_contact_content(
    mode: Mode, payload: ContactContentUpsert, db: Annotated[AsyncSession, Depends(get_db)]
) -> ContactContent:
    # INSERT ... ON CONFLICT (mode) DO UPDATE, matching useContactContent.ts's
    # original `.upsert(content, { onConflict: 'mode' })` exactly -- the real
    # reason contact_content.mode is UNIQUE (MIGRATION_PLAN.md §1 finding 3).
    values = payload.model_dump()
    stmt = pg_insert(ContactContent).values(mode=mode, **values)
    stmt = stmt.on_conflict_do_update(index_elements=[ContactContent.mode], set_=values)
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(select(ContactContent).where(ContactContent.mode == mode))
    return result.scalar_one()
