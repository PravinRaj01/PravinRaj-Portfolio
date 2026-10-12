# app/services/opik_api.py -- read side of Opik's REST API, for the admin "AI"
# console (AI v2, Phase 1b). tracing.py is the write side.
#
# The admin panel never talks to Opik directly: the browser calls this backend
# (admin-only), and this module calls Opik with the server-held API key. So the
# key stays on the server and Opik's response shapes are normalised in one place.
#
# Endpoints used (all under {opik_url}/v1/private, auth = the raw API key in
# `Authorization`, workspace in `Comet-Workspace`):
#   GET  /traces              list, with from_time / to_time / filters / search
#   GET  /traces/{id}         one trace
#   GET  /spans?trace_id=     a trace's spans
#   PUT  /traces/{id}/feedback-scores   the admin's thumbs up/down
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(8.0, connect=3.0)
PAGE_SIZE = 100
MAX_TRACES = 500  # per time window; a portfolio's traffic fits comfortably


class OpikNotConfiguredError(RuntimeError):
    pass


class OpikUpstreamError(RuntimeError):
    """Opik refused, failed or couldn't be reached. Carries no response body."""

    def __init__(self, status_code: int | None, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


def is_configured() -> bool:
    return bool(settings.opik_api_key)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _headers() -> dict[str, str]:
    headers = {"Authorization": settings.opik_api_key, "Accept": "application/json"}
    if settings.opik_workspace:
        headers["Comet-Workspace"] = settings.opik_workspace
    return headers


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    expected_statuses: tuple[int, ...] = (),
) -> Any:
    """`expected_statuses` are failures the caller handles itself (e.g. 409
    "already exists"); they are still raised, just not logged as warnings."""
    if not is_configured():
        raise OpikNotConfiguredError("OPIK_API_KEY is not set")
    url = f"{settings.opik_url.rstrip('/')}/{path.lstrip('/')}"
    clean = {k: v for k, v in (params or {}).items() if v is not None}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.request(method, url, headers=_headers(), params=clean, json=json_body)
    except httpx.HTTPError as exc:
        raise OpikUpstreamError(None, "Opik could not be reached") from exc
    if response.status_code >= 400:
        if response.status_code not in expected_statuses:
            # Status only: never the body, the URL's query or any header.
            logger.warning("Opik API error: %s %s -> HTTP %s", method, path.split("?")[0], response.status_code)
        raise OpikUpstreamError(response.status_code, f"Opik returned HTTP {response.status_code}")
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError as exc:
        raise OpikUpstreamError(response.status_code, "Opik returned an unreadable response") from exc


async def list_traces(
    *,
    page: int = 1,
    size: int = PAGE_SIZE,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    tags: list[str] | None = None,
    search: str | None = None,
    truncate: bool = True,
) -> dict[str, Any]:
    """One page of this project's traces, newest first. `tags` are ANDed."""
    filters = [{"field": "tags", "operator": "contains", "value": t} for t in tags or []]
    data = await _request(
        "GET",
        "v1/private/traces",
        params={
            "project_name": settings.opik_project_name,
            "page": page,
            "size": size,
            "truncate": "true" if truncate else "false",
            "from_time": iso(from_time) if from_time else None,
            "to_time": iso(to_time) if to_time else None,
            "filters": json.dumps(filters) if filters else None,
            "search": search or None,
        },
    )
    if not isinstance(data, dict):
        return {"content": [], "total": 0}
    return data


async def fetch_traces(
    from_time: datetime, to_time: datetime, *, cap: int = MAX_TRACES
) -> tuple[list[dict[str, Any]], bool]:
    """Every trace in the window up to `cap`, and whether more existed."""
    collected: list[dict[str, Any]] = []
    page = 1
    while len(collected) < cap:
        data = await list_traces(page=page, size=PAGE_SIZE, from_time=from_time, to_time=to_time)
        content = [t for t in data.get("content") or [] if isinstance(t, dict)]
        collected.extend(content)
        total = data.get("total")
        if not content or (isinstance(total, int) and len(collected) >= total):
            return collected[:cap], False
        page += 1
    return collected[:cap], True


async def get_trace(trace_id: uuid.UUID) -> dict[str, Any]:
    data = await _request("GET", f"v1/private/traces/{trace_id}", params={"strip_attachments": "true"})
    if not isinstance(data, dict):
        raise OpikUpstreamError(None, "Opik returned an unexpected trace")
    return data


async def list_spans(trace_id: uuid.UUID) -> list[dict[str, Any]]:
    data = await _request(
        "GET",
        "v1/private/spans",
        params={
            "project_name": settings.opik_project_name,
            "trace_id": str(trace_id),
            "size": 200,
            "truncate": "false",
        },
    )
    content = data.get("content") if isinstance(data, dict) else None
    return [s for s in content or [] if isinstance(s, dict)]


async def list_experiments(*, page: int = 1, size: int = 50) -> list[dict[str, Any]]:
    """Recent experiments (evaluation runs), newest first."""
    data = await _request(
        "GET",
        "v1/private/experiments",
        params={"page": page, "size": size},
    )
    content = data.get("content") if isinstance(data, dict) else None
    return [e for e in content or [] if isinstance(e, dict)]


async def add_feedback(trace_id: uuid.UUID, *, name: str, value: float, reason: str | None) -> None:
    body: dict[str, Any] = {"name": name, "value": value, "source": "ui"}
    if reason:
        body["reason"] = reason
    await _request("PUT", f"v1/private/traces/{trace_id}/feedback-scores", json_body=body)
