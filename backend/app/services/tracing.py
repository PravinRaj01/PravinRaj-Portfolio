# app/services/tracing.py -- Opik observability over Opik's REST API.
#
# Plain httpx, like every other outbound call in this backend. The opik SDK is
# deliberately not used: it pulls in ~245 MB of dependencies (boto3, aiohttp,
# litellm...), which doesn't fit comfortably in a Vercel function bundle, and
# its background batching thread can't be trusted to finish on a serverless
# runtime that freezes the process once the response is sent. Here a trace is
# built in memory and delivered with one awaited POST in `finish()`, inside the
# request's own lifetime.
#
# Design rules:
#   * Fails open. Every public method swallows its own errors, so tracing can
#     never turn a working request into a failing one.
#   * Strict no-op when disabled (opik_enabled false, or no API key): callers
#     get a disabled Trace whose methods do nothing and whose `enabled` flag is
#     False, so hot paths can skip building payloads.
#   * One "current trace" per request, held in a ContextVar. Low-level code
#     (the LLM gateway, the embeddings client) attaches spans to it with
#     `current_trace().span(...)` without any signature having to carry it.
#   * No IPs or visitor identifiers are recorded -- only what a quality review
#     needs: the message, the reply, retrieval titles, scores, timings.
import asyncio
import contextvars
import logging
import time
import traceback as traceback_module
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_STRING = 12_000  # per string value; prompts are long, but not unbounded
_MAX_DEPTH = 6

# The trace being built for the request being served. Spans created by
# lower layers attach to it; outside any trace it holds the disabled trace.
_current: contextvars.ContextVar["Trace | None"] = contextvars.ContextVar("opik_current_trace", default=None)


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _uuid7() -> str:
    """Opik requires time-ordered UUIDv7 ids (uuid.uuid7 only exists on 3.14+,
    and this backend supports 3.11)."""
    ms = time.time_ns() // 1_000_000
    rand = uuid.uuid4().int
    value = (ms & ((1 << 48) - 1)) << 80
    value |= 0x7 << 76
    value |= ((rand >> 64) & 0xFFF) << 64
    value |= 0b10 << 62
    value |= rand & ((1 << 62) - 1)
    return str(uuid.UUID(int=value))


def _clip(value: Any, depth: int = 0) -> Any:
    """JSON-safe copy with long strings truncated and image data URIs dropped."""
    if isinstance(value, str):
        if value.startswith("data:") and ";base64," in value[:80]:
            return "[inline image omitted]"
        return value if len(value) <= _MAX_STRING else value[:_MAX_STRING] + f"... [{len(value) - _MAX_STRING} more chars]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if depth >= _MAX_DEPTH:
        return str(value)[:200]
    if isinstance(value, dict):
        return {str(k): _clip(v, depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_clip(v, depth + 1) for v in value]
    return str(value)[:500]


def _error_info(exc: BaseException) -> dict[str, str]:
    return {
        "exception_type": type(exc).__name__,
        "message": str(exc)[:500],
        "traceback": "".join(traceback_module.format_exception(type(exc), exc, exc.__traceback__))[-4000:],
    }


def is_configured() -> bool:
    return bool(settings.opik_enabled and settings.opik_api_key)


class Span:
    """One timed step of a trace. Also a context manager: an exception inside
    the block is recorded on the span and re-raised."""

    def __init__(self, trace: "Trace", name: str, type_: str, input_: Any, parent: "Span | None") -> None:
        self.trace = trace
        self.enabled = trace.enabled
        self.name = name
        self.type = type_
        self.input = input_
        self.output: Any = None
        self.metadata: dict[str, Any] = {}
        self.tags: list[str] = []
        self.model: str | None = None
        self.provider: str | None = None
        self.usage: dict[str, int] | None = None
        self.ttft_ms: float | None = None
        self.error: dict[str, str] | None = None
        self.id = _uuid7() if self.enabled else ""
        self.parent_id = parent.id if parent is not None else None
        self.started = _now() if self.enabled else ""
        self.ended: str | None = None

    def set(
        self,
        *,
        output: Any = None,
        metadata: dict[str, Any] | None = None,
        model: str | None = None,
        provider: str | None = None,
        usage: dict[str, int] | None = None,
        ttft_ms: float | None = None,
    ) -> "Span":
        if not self.enabled:
            return self
        try:
            if output is not None:
                self.output = output
            if metadata:
                self.metadata.update(metadata)
            if model is not None:
                self.model = model
            if provider is not None:
                self.provider = provider
            if usage is not None:
                self.usage = usage
            if ttft_ms is not None:
                self.ttft_ms = round(ttft_ms, 1)
        except Exception:  # pragma: no cover - defensive, tracing must never raise
            logger.debug("tracing: Span.set failed", exc_info=True)
        return self

    def fail(self, exc: BaseException) -> "Span":
        if self.enabled and self.error is None:
            try:
                self.error = _error_info(exc)
                # A failed step is often recovered from (provider 429 -> fallback,
                # embedding down -> full-context prompt), so it doesn't make the
                # whole trace an "error" -- only Trace.fail does that.
                self.trace.tag("span_error")
            except Exception:  # pragma: no cover
                logger.debug("tracing: Span.fail failed", exc_info=True)
        return self

    def end(self, output: Any = None, **kwargs: Any) -> "Span":
        """Idempotent: a span is closed once, later calls only add detail."""
        if not self.enabled:
            return self
        self.set(output=output, **kwargs)
        if self.ended is None:
            self.ended = _now()
        return self

    def __enter__(self) -> "Span":
        return self

    def __exit__(self, exc_type: Any, exc: BaseException | None, tb: Any) -> None:
        if exc is not None:
            self.fail(exc)
        self.end()

    def _payload(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "id": self.id,
            "trace_id": self.trace.id,
            "project_name": settings.opik_project_name,
            "name": self.name,
            "type": self.type,
            "start_time": self.started,
            "end_time": self.ended or _now(),
            "input": _clip(self.input) if self.input is not None else None,
            "output": _clip(self.output) if self.output is not None else None,
            "metadata": _clip(self.metadata) if self.metadata else None,
        }
        if self.parent_id:
            body["parent_span_id"] = self.parent_id
        if self.model:
            body["model"] = self.model
        if self.provider:
            body["provider"] = self.provider
        if self.usage:
            body["usage"] = {k: int(v) for k, v in self.usage.items()}
        if self.ttft_ms is not None:
            body["ttft"] = self.ttft_ms
        if self.tags:
            body["tags"] = self.tags
        if self.error:
            body["error_info"] = self.error
        return {k: v for k, v in body.items() if v is not None}


class Trace:
    """One request's worth of spans, delivered to Opik by `finish()`."""

    def __init__(
        self,
        name: str,
        *,
        enabled: bool,
        input_: Any = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.enabled = enabled
        self.name = name
        self.input = input_
        self.output: Any = None
        self.tags: list[str] = list(tags or [])
        self.metadata: dict[str, Any] = dict(metadata or {})
        self.spans: list[Span] = []
        self.error: dict[str, str] | None = None
        self.ttft_ms: float | None = None
        self.id = _uuid7() if enabled else ""
        self.started = _now() if enabled else ""
        self._finished = False

    # -- recording ---------------------------------------------------------

    def span(self, name: str, *, type: str = "general", input: Any = None) -> Span:  # noqa: A002
        """Opik span types: general | tool | llm | guardrail."""
        span = Span(self, name, type, input, parent=None)
        if self.enabled:
            self.spans.append(span)
        return span

    def tag(self, *tags: str) -> None:
        if self.enabled:
            for t in tags:
                if t not in self.tags:
                    self.tags.append(t)

    def meta(self, **values: Any) -> None:
        if self.enabled:
            self.metadata.update(values)

    def fail(self, exc: BaseException) -> None:
        if self.enabled and self.error is None:
            try:
                self.error = _error_info(exc)
                self.tag("error")
            except Exception:  # pragma: no cover
                logger.debug("tracing: Trace.fail failed", exc_info=True)

    def set_output(self, value: Any) -> None:
        if self.enabled:
            self.output = value

    def discard(self) -> None:
        """Drops the trace without sending it (e.g. a re-index that changed nothing)."""
        self._finished = True
        self._release()

    def _release(self) -> None:
        if _current.get() is self:
            _current.set(None)

    def _last_llm_output(self) -> Any:
        for span in reversed(self.spans):
            if span.type == "llm" and span.output is not None:
                return span.output
        return None

    # -- delivery ----------------------------------------------------------

    async def finish(self, output: Any = None, *, error: BaseException | None = None) -> None:
        """Closes every open span, then POSTs the trace and its spans. Awaited
        inside the request: on a serverless runtime nothing may be left to run
        after the response, so delivery has to finish (or time out) here."""
        if not self.enabled or self._finished:
            return
        self._finished = True
        try:
            if error is not None:
                self.fail(error)
            if output is not None:
                self.output = output
            elif self.output is None:
                self.output = self._last_llm_output()
            ttfts = [s.ttft_ms for s in self.spans if s.type == "llm" and s.ttft_ms is not None]
            if ttfts:
                self.ttft_ms = ttfts[-1]
            for span in self.spans:
                span.end()
            await asyncio.wait_for(self._deliver(), timeout=settings.opik_flush_timeout)
        except Exception as exc:  # incl. TimeoutError; tracing never breaks a request
            logger.warning("Opik trace delivery failed: %s", type(exc).__name__)
        finally:
            self._release()

    def _payload(self) -> dict[str, Any]:
        metadata = {"environment": settings.environment, **self.metadata}
        if self.ttft_ms is not None:
            metadata["ttft_ms"] = self.ttft_ms
        body: dict[str, Any] = {
            "id": self.id,
            "project_name": settings.opik_project_name,
            "name": self.name,
            "start_time": self.started,
            "end_time": _now(),
            "input": _clip(self.input) if self.input is not None else None,
            "output": _clip(self.output) if self.output is not None else None,
            "metadata": _clip(metadata),
            "tags": self.tags or None,
        }
        if self.ttft_ms is not None:
            body["ttft"] = self.ttft_ms
        if self.error:
            body["error_info"] = self.error
        return {k: v for k, v in body.items() if v is not None}

    async def _deliver(self) -> None:
        base = settings.opik_url.rstrip("/")
        headers = {"Authorization": settings.opik_api_key, "Content-Type": "application/json"}
        if settings.opik_workspace:
            headers["Comet-Workspace"] = settings.opik_workspace
        async with httpx.AsyncClient(timeout=httpx.Timeout(settings.opik_flush_timeout, connect=2.0)) as client:
            # Independent endpoints; Opik tolerates either arriving first.
            responses = await asyncio.gather(
                client.post(f"{base}/v1/private/traces/batch", headers=headers, json={"traces": [self._payload()]}),
                client.post(
                    f"{base}/v1/private/spans/batch",
                    headers=headers,
                    json={"spans": [s._payload() for s in self.spans]},
                )
                if self.spans
                else asyncio.sleep(0),
            )
        for response in responses:
            if isinstance(response, httpx.Response) and response.status_code >= 400:
                # Status only: never log the body, headers or payload.
                logger.warning("Opik rejected a trace: HTTP %s", response.status_code)

    # -- async context manager: the form admin endpoints use ---------------

    async def __aenter__(self) -> "Trace":
        return self

    async def __aexit__(self, exc_type: Any, exc: BaseException | None, tb: Any) -> None:
        await self.finish(error=exc)


_DISABLED = Trace("disabled", enabled=False)


def current_trace() -> Trace:
    """The active trace, or a shared disabled one -- always safe to call."""
    return _current.get() or _DISABLED


def start_trace(
    name: str,
    *,
    input: Any = None,  # noqa: A002
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Trace:
    """Begins a trace and makes it the request's current one. Returns a
    disabled (no-op) trace when Opik isn't configured."""
    if not is_configured():
        return _DISABLED
    try:
        trace = Trace(name, enabled=True, input_=input, tags=tags, metadata=metadata)
        _current.set(trace)
        return trace
    except Exception:  # pragma: no cover
        logger.debug("tracing: start_trace failed", exc_info=True)
        return _DISABLED


def trace(
    name: str,
    *,
    input: Any = None,  # noqa: A002
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Trace:
    """`async with tracing.trace("admin.x", input=...) as t:` -- starts the
    trace, and on exit records any exception and delivers it."""
    return start_trace(name, input=input, tags=tags, metadata=metadata)
