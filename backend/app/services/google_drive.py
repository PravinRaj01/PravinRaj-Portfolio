# app/services/google_drive.py — MIGRATION_PLAN.md §7 "stubs" row: replaces
# supabase/functions/google-drive-proxy. Read-only: lists files in a single
# public Drive folder via the public API key (Files: list), same three
# actions (test/count/list) the original Edge Function exposed.
from typing import Any, Literal

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

DEFAULT_FOLDER_ID = "1W0BOH7HfQLCggD3MEU548uzjaq3kWoVN"
_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"


class DriveNotConfiguredError(RuntimeError):
    pass


async def _list_files(folder_id: str, fields: str | None = None) -> list[dict[str, Any]]:
    if not settings.google_drive_api_key:
        raise DriveNotConfiguredError("GOOGLE_DRIVE_API_KEY is not configured")

    params = {"q": f"'{folder_id}' in parents", "key": settings.google_drive_api_key}
    if fields:
        params["fields"] = fields

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(_DRIVE_FILES_URL, params=params)

    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Drive API error: {response.status_code} {response.reason_phrase}",
        )
    data = response.json()
    return data.get("files", [])


async def test_connection(folder_id: str) -> dict[str, Any]:
    files = await _list_files(folder_id)
    return {"success": True, "message": f"Connected successfully. Found {len(files)} files in folder."}


async def count_files(folder_id: str) -> dict[str, int]:
    files = await _list_files(folder_id)
    return {"count": len(files)}


async def list_files(folder_id: str) -> dict[str, list[dict[str, Any]]]:
    files = await _list_files(
        folder_id, fields="files(id,name,mimeType,thumbnailLink,webViewLink,parents)"
    )
    return {"files": files}


DriveAction = Literal["test", "count", "list"]
