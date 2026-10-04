# app/api/routers/ai.py — replaces supabase/functions/{generate-description,
# generate-magazine,portfolio-chat}. generate-description and
# generate-magazine are admin-only (only ever called from admin editor UIs);
# chat is public, matching the original Edge Function's verify_jwt=false.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
from app.services import ai_content, chat_throttle, rag_index
from app.services.ai_gateway import AIGatewayNotConfiguredError
from app.services.embeddings import RagUnavailableError

router = APIRouter(prefix="/ai", tags=["ai"])


def _not_configured() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI service not configured",
    )


def _client_ip(request: Request) -> str:
    # Same convention as app/api/routers/auth.py's _client_ip: Vercel (and
    # most proxies) set X-Forwarded-For as "client, proxy1, proxy2".
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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


@router.post("/reindex", dependencies=[Depends(require_admin)])
async def reindex(
    db: Annotated[AsyncSession, Depends(get_db)], force: bool = False
) -> dict[str, int]:
    """Rebuilds the chatbot's RAG index. Only chunks whose text changed are
    re-embedded; `force=true` re-embeds everything."""
    try:
        return await rag_index.reindex(db, force=force)
    except RagUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/chat")
async def chat(
    payload: ChatRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]
) -> StreamingResponse:
    if not settings.gemini_api_key and not settings.groq_api_key:
        raise _not_configured()

    ip = _client_ip(request)
    if await chat_throttle.is_rate_limited(db, ip=ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many messages. Please try again in a few minutes.",
        )

    # open_chat_stream is awaited here, not handed to StreamingResponse as a
    # generator — it connects to a provider and confirms a successful status
    # before returning, so a config/upstream failure raises a real
    # HTTPException instead of a broken empty stream (Starlette sends the
    # 200 status line before it starts consuming the body iterator, so an
    # exception raised from inside a generator can no longer change the
    # response status). See ai_gateway.open_stream's docstring.
    try:
        stream = await ai_content.open_chat_stream(db, payload)
    except AIGatewayNotConfiguredError as exc:
        raise _not_configured() from exc

    await chat_throttle.record_request(db, ip=ip)
    return StreamingResponse(stream, media_type="text/event-stream")
