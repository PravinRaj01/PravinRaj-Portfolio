# app/api/routers/resumes.py — MIGRATION_PLAN.md §7 (resumes row)
#
# POST /resumes/{mode}: delete the old R2 object (if the current URL is one
# we manage), upload the new one, and set site_settings.{mode}_resume_url --
# all in one request, matching ResumeManager.tsx's original single-call
# semantics (which previously did the same thing against Supabase Storage).
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.site import SiteSettings
from app.schemas.common import Mode
from app.schemas.storage import ResumeResponse
from app.services import storage_r2

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10MB, matches ResumeManager.tsx's original client-side check


async def _get_site_settings(db: AsyncSession) -> SiteSettings:
    row = (await db.execute(select(SiteSettings).limit(1))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site settings not found")
    return row


def _resume_field(mode: Mode) -> str:
    return "professional_resume_url" if mode == "professional" else "creative_resume_url"


@router.post("/{mode}", response_model=ResumeResponse, dependencies=[Depends(require_admin)])
async def upload_resume(
    mode: Mode,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> ResumeResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a PDF file")

    data = await file.read()
    if len(data) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File size must be less than 10MB"
        )
    # The real guard: a client can declare any Content-Type it likes, so the
    # check above is just a fast, friendly error -- this checks the actual
    # file signature (MIGRATION_PLAN.md §8).
    if not storage_r2.is_valid_pdf(data):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid PDF")

    settings_row = await _get_site_settings(db)
    field = _resume_field(mode)
    old_url = getattr(settings_row, field)
    if old_url:
        old_key = storage_r2.key_from_public_url(old_url)
        if old_key:
            await storage_r2.delete_object(old_key)

    # Millisecond-epoch filename, matching the original
    # `${mode}-resume-${Date.now()}.pdf` convention exactly.
    key = f"resumes/{mode}-resume-{int(time.time() * 1000)}.pdf"
    new_url = await storage_r2.put_object(key, data, content_type="application/pdf")

    setattr(settings_row, field, new_url)
    await db.commit()

    return ResumeResponse(mode=mode, url=new_url)


@router.delete("/{mode}", response_model=ResumeResponse, dependencies=[Depends(require_admin)])
async def delete_resume(mode: Mode, db: Annotated[AsyncSession, Depends(get_db)]) -> ResumeResponse:
    settings_row = await _get_site_settings(db)
    field = _resume_field(mode)
    old_url = getattr(settings_row, field)
    if old_url:
        old_key = storage_r2.key_from_public_url(old_url)
        if old_key:
            await storage_r2.delete_object(old_key)

    setattr(settings_row, field, None)
    await db.commit()

    return ResumeResponse(mode=mode, url=None)
