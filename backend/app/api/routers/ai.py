# app/api/routers/ai.py — MIGRATION_PLAN.md §7 "stubs" row: replaces
# supabase/functions/{generate-description,generate-magazine,portfolio-chat}.
# generate-description and generate-magazine are admin-only (they were only
# ever called from admin editor UIs); chat is public, matching the original
# Edge Function's verify_jwt=false.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.config import settings
from app.schemas.ai import (
    ChatRequest,
    DescriptionGenerateRequest,
    DescriptionGenerateResponse,
    MagazineGenerateRequest,
    MagazineGenerateResponse,
)
from app.services import ai_content
from app.services.ai_gateway import AIGatewayNotConfiguredError

router = APIRouter(prefix="/ai", tags=["ai"])


def _not_configured() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI service not configured",
    )


@router.post(
    "/generate-description",
    response_model=DescriptionGenerateResponse,
    dependencies=[Depends(require_admin)],
)
async def generate_description(payload: DescriptionGenerateRequest) -> DescriptionGenerateResponse:
    try:
        return await ai_content.generate_description(payload)
    except AIGatewayNotConfiguredError as exc:
        raise _not_configured() from exc


@router.post(
    "/generate-magazine",
    response_model=MagazineGenerateResponse,
    dependencies=[Depends(require_admin)],
)
async def generate_magazine(
    payload: MagazineGenerateRequest, db: Annotated[AsyncSession, Depends(get_db)]
) -> MagazineGenerateResponse:
    try:
        return await ai_content.generate_magazine(db, payload)
    except AIGatewayNotConfiguredError as exc:
        raise _not_configured() from exc


@router.post("/chat")
async def chat(payload: ChatRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> StreamingResponse:
    # The stream generator itself calls the gateway lazily on first
    # iteration, so the "not configured" check has to happen before
    # StreamingResponse starts iterating -- otherwise the error would
    # arrive as a broken mid-stream chunk instead of a clean 503.
    if not settings.lovable_api_key:
        raise _not_configured()
    return StreamingResponse(ai_content.stream_chat(db, payload), media_type="text/event-stream")
