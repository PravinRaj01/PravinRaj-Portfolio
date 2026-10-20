# app/api/routers/ai.py — replaces supabase/functions/{generate-description,
# generate-magazine,portfolio-chat}. generate-description and
# generate-magazine are admin-only (only ever called from admin editor UIs);
# chat is public, matching the original Edge Function's verify_jwt=false.
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.config import settings
from app.models.projects import Project
from app.schemas.ai import (
    ChatRequest,
    DescriptionGenerateRequest,
    DescriptionGenerateResponse,
    MagazineGenerateRequest,
    MagazineGenerateResponse,
    RepoImportRequest,
    RepoImportResponse,
    RepoStatus,
)
from app.services import ai_content, chat_throttle, github_repo, rag_index, repo_import
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


@router.post(
    "/project-from-repo",
    response_model=RepoImportResponse,
    dependencies=[Depends(require_admin)],
)
async def project_from_repo(
    payload: RepoImportRequest, db: Annotated[AsyncSession, Depends(get_db)]
) -> RepoImportResponse:
    """Reads a GitHub repository and returns a draft for the project form.
    Writes nothing: the admin reviews the draft and saves it as a normal
    project (which is what triggers the usual re-index)."""
    try:
        return await repo_import.generate_project_draft(db, payload)
    except AIGatewayNotConfiguredError as exc:
        raise _not_configured() from exc
    except github_repo.RepoUrlError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except github_repo.RepoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found. If it is private, set GITHUB_TOKEN on the backend.",
        ) from exc
    except github_repo.RepoRateLimitedError as exc:
        when = f" Try again after {exc.reset_at}." if exc.reset_at else ""
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"GitHub's rate limit was reached.{when} Setting GITHUB_TOKEN raises the limit.",
        ) from exc
    except github_repo.GitHubUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


def _is_newer(remote: str, stored: str) -> bool:
    try:
        return datetime.fromisoformat(remote.replace("Z", "+00:00")) > datetime.fromisoformat(stored.replace("Z", "+00:00"))
    except ValueError:
        return remote != stored  # unreadable stored value: treat any difference as a change


@router.get("/repo-status", response_model=list[RepoStatus], dependencies=[Depends(require_admin)])
async def repo_status(db: Annotated[AsyncSession, Depends(get_db)], mode: str) -> list[RepoStatus]:
    """For each project in `mode` that has a GitHub URL: has the repository been
    pushed to since the project was last synced? Read-only; a repo GitHub can't
    answer for is `unavailable`, never an error for the whole call."""
    if mode not in ("professional", "creative"):
        raise HTTPException(status_code=422, detail="mode must be professional or creative")
    rows = (
        await db.execute(
            select(Project.id, Project.github_url, Project.github_pushed_at).where(
                Project.mode == mode, Project.github_url.is_not(None), Project.github_url != ""
            )
        )
    ).all()

    parsed: dict[str, tuple[str, str]] = {}
    for project_id, url, _ in rows:
        try:
            parsed[str(project_id)] = github_repo.parse_repo_url(url)
        except github_repo.RepoUrlError:
            continue  # not a GitHub repo URL: reported as unavailable below
    remote = await github_repo.fetch_many_pushed_at(list(parsed.values()))

    results: list[RepoStatus] = []
    for project_id, _, stored in rows:
        pid = str(project_id)
        pair = parsed.get(pid)
        if pair is None or pair not in remote:
            results.append(RepoStatus(project_id=pid, state="unavailable"))
            continue
        pushed_at = remote[pair]
        if not stored:
            state = "never_synced"
        elif pushed_at and _is_newer(pushed_at, stored):
            state = "changed"
        else:
            state = "up_to_date"
        results.append(RepoStatus(project_id=pid, state=state, pushed_at=pushed_at))
    return results


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
