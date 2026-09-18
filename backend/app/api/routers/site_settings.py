# app/api/routers/site_settings.py — MIGRATION_PLAN.md §7: singleton table
# GET /site-settings       -> full row, 404 if the table is empty
# GET /site-settings/modes -> the 5-column subset PortfolioContext.tsx selects
# PUT /site-settings       -> upsert the singleton: update the row if one
#                             exists, insert if the table is empty
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.site import SiteSettings
from app.schemas.site import SiteSettingsModeRead, SiteSettingsRead, SiteSettingsUpsert

router = APIRouter(prefix="/site-settings", tags=["site-settings"])


async def _get_singleton_row(db: AsyncSession) -> SiteSettings:
    result = await db.execute(select(SiteSettings).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site settings not found")
    return row


@router.get("", response_model=SiteSettingsRead)
async def get_site_settings(db: Annotated[AsyncSession, Depends(get_db)]) -> SiteSettings:
    return await _get_singleton_row(db)


@router.get("/modes", response_model=SiteSettingsModeRead)
async def get_site_settings_modes(db: Annotated[AsyncSession, Depends(get_db)]) -> SiteSettings:
    return await _get_singleton_row(db)


@router.put("", response_model=SiteSettingsRead, dependencies=[Depends(require_admin)])
async def upsert_site_settings(
    payload: SiteSettingsUpsert, db: Annotated[AsyncSession, Depends(get_db)]
) -> SiteSettings:
    result = await db.execute(select(SiteSettings).limit(1))
    row = result.scalar_one_or_none()
    data = payload.model_dump(exclude_unset=True)

    if row is None:
        if not data.get("site_name"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="site_name is required to create site_settings",
            )
        row = SiteSettings(**data)
        db.add(row)
    else:
        for field, value in data.items():
            setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row
