# app/api/routers/drive.py — MIGRATION_PLAN.md §7: GET /drive/{test,count,list}
# Replaces supabase/functions/google-drive-proxy. Public and read-only, same
# as the original Edge Function (it was called from public gallery views,
# not just the admin panel).
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.services import google_drive
from app.services.google_drive import DEFAULT_FOLDER_ID, DriveNotConfiguredError

router = APIRouter(prefix="/drive", tags=["drive"])


@router.get("/test")
async def test_drive_connection(folder_id: Annotated[str, Query()] = DEFAULT_FOLDER_ID) -> dict:
    try:
        return await google_drive.test_connection(folder_id)
    except DriveNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/count")
async def get_drive_file_count(folder_id: Annotated[str, Query()] = DEFAULT_FOLDER_ID) -> dict:
    try:
        return await google_drive.count_files(folder_id)
    except DriveNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/list")
async def list_drive_files(folder_id: Annotated[str, Query()] = DEFAULT_FOLDER_ID) -> dict:
    try:
        return await google_drive.list_files(folder_id)
    except DriveNotConfiguredError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
