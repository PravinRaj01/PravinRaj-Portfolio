# app/api/routers/drive.py — MIGRATION_PLAN.md §7: GET /drive/{test,count,list}
# Replaces supabase/functions/google-drive-proxy. Public and read-only, same
# as the original Edge Function (it was called from public gallery views,
# not just the admin panel).
#
# The frontend (src/services/googleDriveService.ts) sends the camelCase
# `folderId` the old Edge Function used, so both spellings are accepted here;
# otherwise every subfolder request silently fell back to DEFAULT_FOLDER_ID.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services import google_drive
from app.services.google_drive import DEFAULT_FOLDER_ID, DriveNotConfiguredError

router = APIRouter(prefix="/drive", tags=["drive"])


def resolve_folder_id(
    folder_id: Annotated[str | None, Query()] = None,
    folderId: Annotated[str | None, Query()] = None,  # noqa: N803 - client sends camelCase
) -> str:
    return folder_id or folderId or DEFAULT_FOLDER_ID


FolderId = Annotated[str, Depends(resolve_folder_id)]


def _not_configured(exc: DriveNotConfiguredError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


@router.get("/test")
async def test_drive_connection(folder_id: FolderId) -> dict:
    try:
        return await google_drive.test_connection(folder_id)
    except DriveNotConfiguredError as exc:
        raise _not_configured(exc) from exc


@router.get("/count")
async def get_drive_file_count(folder_id: FolderId) -> dict:
    try:
        return await google_drive.count_files(folder_id)
    except DriveNotConfiguredError as exc:
        raise _not_configured(exc) from exc


@router.get("/list")
async def list_drive_files(folder_id: FolderId) -> dict:
    try:
        return await google_drive.list_files(folder_id)
    except DriveNotConfiguredError as exc:
        raise _not_configured(exc) from exc
