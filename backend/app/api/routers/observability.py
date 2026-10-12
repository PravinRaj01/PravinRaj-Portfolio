# app/api/routers/observability.py -- the admin "AI" console's data (AI v2,
# Phase 1b). Everything is admin-only and read-mostly: it proxies Opik's REST
# API (app/services/opik_api.py) so the Opik key never reaches the browser.
#
# Mounted under /api/v1/ai/observability, which main.py's re-index middleware
# already skips (it ignores everything under /ai).
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_admin
from app.core.config import settings
from app.schemas.observability import (
    FeedbackRequest,
    RangeKey,
    StatusResponse,
    SummaryResponse,
    TimeseriesResponse,
    TraceDetail,
    TracesPage,
    TraceTag,
)
from app.services import observability, opik_api

router = APIRouter(
    prefix="/ai/observability", tags=["ai-observability"], dependencies=[Depends(require_admin)]
)

_CLOUD_PREFIX = "https://www.comet.com"


def _not_configured() -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Opik is not configured")


def _upstream(exc: opik_api.OpikUpstreamError) -> HTTPException:
    if exc.status_code == 404:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found in Opik")
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Opik request failed")


@router.get("/status", response_model=StatusResponse)
async def get_status() -> StatusResponse:
    workspace = settings.opik_workspace or None
    on_cloud = settings.opik_url.startswith(_CLOUD_PREFIX)
    return StatusResponse(
        configured=opik_api.is_configured(),
        tracing_enabled=settings.opik_enabled,
        project=settings.opik_project_name,
        workspace=workspace,
        dashboard_url=f"{_CLOUD_PREFIX}/opik/{workspace}/projects" if workspace and on_cloud else None,
    )


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(range: Annotated[RangeKey, Query()] = "7d") -> dict:  # noqa: A002
    try:
        window = await observability.get_window(range)
    except opik_api.OpikNotConfiguredError as exc:
        raise _not_configured() from exc
    except opik_api.OpikUpstreamError as exc:
        raise _upstream(exc) from exc
    return observability.build_summary(window)


@router.get("/timeseries", response_model=TimeseriesResponse)
async def get_timeseries(range: Annotated[RangeKey, Query()] = "7d") -> dict:  # noqa: A002
    try:
        window = await observability.get_window(range)
    except opik_api.OpikNotConfiguredError as exc:
        raise _not_configured() from exc
    except opik_api.OpikUpstreamError as exc:
        raise _upstream(exc) from exc
    return observability.build_timeseries(window)


@router.get("/traces", response_model=TracesPage)
async def list_traces(
    range: Annotated[RangeKey, Query()] = "7d",  # noqa: A002
    tag: Annotated[TraceTag | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=100)] = 1,
    size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> dict:
    now = datetime.now(timezone.utc)
    try:
        data = await opik_api.list_traces(
            page=page,
            size=size,
            from_time=now - observability.RANGES[range],
            to_time=now,
            tags=[tag] if tag else None,
            search=search.strip() if search and search.strip() else None,
        )
    except opik_api.OpikNotConfiguredError as exc:
        raise _not_configured() from exc
    except opik_api.OpikUpstreamError as exc:
        raise _upstream(exc) from exc
    content = [t for t in data.get("content") or [] if isinstance(t, dict)]
    total = data.get("total")
    return {
        "rows": [observability.trace_row(t) for t in content],
        "page": page,
        "size": size,
        "total": total if isinstance(total, int) else len(content),
    }


@router.get("/traces/{trace_id}", response_model=TraceDetail)
async def get_trace(trace_id: uuid.UUID) -> dict:
    try:
        trace = await opik_api.get_trace(trace_id)
        spans = await opik_api.list_spans(trace_id)
    except opik_api.OpikNotConfiguredError as exc:
        raise _not_configured() from exc
    except opik_api.OpikUpstreamError as exc:
        raise _upstream(exc) from exc
    return observability.trace_detail(trace, spans)


@router.post("/traces/{trace_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def add_feedback(trace_id: uuid.UUID, payload: FeedbackRequest) -> None:
    """Records the admin's verdict as an Opik feedback score, so it shows up in
    Opik too and feeds the quality trend."""
    comment = payload.comment.strip() if payload.comment else None
    try:
        await opik_api.add_feedback(trace_id, name=payload.name, value=float(payload.score), reason=comment or None)
    except opik_api.OpikNotConfiguredError as exc:
        raise _not_configured() from exc
    except opik_api.OpikUpstreamError as exc:
        raise _upstream(exc) from exc
    observability.clear_cache()  # the rating average just changed
