# app/services/ai_gateway.py — replaces the old Lovable AI gateway wrapper.
#
# Gemini (primary) and Groq (fallback), both free-tier, both spoken through
# their OpenAI-compatible chat-completions endpoints via plain httpx -- no
# provider SDK needed. `model_kind` ("chat" or "content") picks which pair of
# model-name settings to use; see app/core/config.py.
#
# Fallback only happens on a transport-level failure (429 rate-limited, or a
# 5xx) from the current provider, and only when a later provider is
# configured. A caller that needs different content per provider (dropping
# images for Groq's text-only content model, or a trimmed context to fit
# Groq's tighter tokens-per-minute budget) passes `fallback_messages`, sent
# to every provider after the first instead of `messages`.
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.services import tracing

logger = logging.getLogger(__name__)

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_TIMEOUT = httpx.Timeout(55.0, connect=10.0)  # fits inside Vercel's 60s function limit


class AIGatewayNotConfiguredError(RuntimeError):
    pass


@dataclass(frozen=True)
class _Provider:
    name: str
    base_url: str
    api_key: str
    model: str


def _providers(*, model_kind: str) -> list[_Provider]:
    providers: list[_Provider] = []
    if settings.gemini_api_key:
        model = settings.gemini_chat_model if model_kind == "chat" else settings.gemini_content_model
        providers.append(_Provider("gemini", _GEMINI_URL, settings.gemini_api_key, model))
    if settings.groq_api_key:
        model = settings.groq_chat_model if model_kind == "chat" else settings.groq_content_model
        providers.append(_Provider("groq", _GROQ_URL, settings.groq_api_key, model))
    return providers


def _require_providers(model_kind: str) -> list[_Provider]:
    providers = _providers(model_kind=model_kind)
    if not providers:
        raise AIGatewayNotConfiguredError("Neither GEMINI_API_KEY nor GROQ_API_KEY is configured")
    return providers


def _headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _should_fall_back(response: httpx.Response) -> bool:
    return response.status_code == 429 or response.status_code >= 500


def _map_gateway_error(response: httpx.Response) -> HTTPException:
    if response.status_code == 429:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI is temporarily busy. Please try again in a minute.",
        )
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI gateway request failed")


def _pick_messages(
    messages: list[dict[str, Any]], fallback_messages: list[dict[str, Any]] | None, index: int
) -> list[dict[str, Any]]:
    return messages if index == 0 or fallback_messages is None else fallback_messages


# --- Opik tracing helpers (tracing.py). All no-ops when Opik is off. ---------


def _llm_span(
    trace: tracing.Trace, provider: _Provider, body: dict[str, Any], *, model_kind: str, attempt: int
) -> tracing.Span:
    """One span per provider attempt, so a Groq fallback after a Gemini 429
    shows up as two spans instead of vanishing."""
    llm_input: dict[str, Any] = {"messages": body["messages"]}
    if body.get("tools"):
        llm_input["tools"] = [t.get("function", {}).get("name") for t in body["tools"]]
    span = trace.span("llm", type="llm", input=llm_input)
    span.set(
        model=provider.model,
        provider=provider.name,
        metadata={"model_kind": model_kind, "attempt": attempt, "stream": bool(body.get("stream"))},
    )
    return span


def _usage_of(usage: Any) -> dict[str, int] | None:
    if not isinstance(usage, dict):
        return None
    picked = {
        key: int(usage[key])
        for key in ("prompt_tokens", "completion_tokens", "total_tokens")
        if isinstance(usage.get(key), (int, float))
    }
    return picked or None


def _completion_output(data: dict[str, Any]) -> Any:
    choices = data.get("choices") or []
    message = (choices[0].get("message") or {}) if choices else {}
    out: dict[str, Any] = {}
    if message.get("content"):
        out["content"] = message["content"]
    if message.get("tool_calls"):
        out["tool_calls"] = [
            {"name": (c.get("function") or {}).get("name"), "arguments": (c.get("function") or {}).get("arguments")}
            for c in message["tool_calls"]
        ]
    return out or None


def _record_provider_used(trace: tracing.Trace, provider: _Provider, attempt: int) -> None:
    trace.meta(provider=provider.name, model=provider.model)
    if attempt > 0:
        trace.tag("fallback")


class StreamObserver:
    """Reads the SSE bytes of a streamed completion as they pass through, only
    to report on them (reply text, token usage, time to first token). It never
    alters the stream, and can never break it: any parsing problem is ignored."""

    def __init__(self, started: float) -> None:
        self._started = started
        self._buffer = b""
        self.parts: list[str] = []
        self.usage: dict[str, int] | None = None
        self.first_token_ms: float | None = None

    @property
    def text(self) -> str:
        return "".join(self.parts)

    def feed(self, chunk: bytes) -> None:
        try:
            self._buffer += chunk
            *lines, self._buffer = self._buffer.split(b"\n")
            for raw in lines:
                self._line(raw.strip())
        except Exception:  # pragma: no cover - observing must never affect the stream
            logger.debug("stream observer failed", exc_info=True)

    def _line(self, raw: bytes) -> None:
        if not raw.startswith(b"data:"):
            return
        payload = raw[5:].strip()
        if not payload or payload == b"[DONE]":
            return
        try:
            data = json.loads(payload)
        except ValueError:
            return
        if not isinstance(data, dict):
            return
        usage = _usage_of(data.get("usage") or (data.get("x_groq") or {}).get("usage"))
        if usage:
            self.usage = usage
        for choice in data.get("choices") or []:
            content = (choice.get("delta") or {}).get("content")
            if content:
                if self.first_token_ms is None:
                    self.first_token_ms = (time.perf_counter() - self._started) * 1000
                self.parts.append(content)


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model_kind: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: dict[str, Any] | None = None,
    max_tokens: int | None = None,
    fallback_messages: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    providers = _require_providers(model_kind)
    last_exc: HTTPException | None = None
    trace = tracing.current_trace()

    for i, provider in enumerate(providers):
        body: dict[str, Any] = {
            "model": provider.model,
            "messages": _pick_messages(messages, fallback_messages, i),
            "stream": False,
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice

        span = _llm_span(trace, provider, body, model_kind=model_kind, attempt=i)
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(provider.base_url, headers=_headers(provider.api_key), json=body)
        except httpx.HTTPError as exc:
            span.fail(exc).end()
            last_exc = HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI gateway request failed")
            if i < len(providers) - 1:
                continue
            raise last_exc from exc

        if response.is_success:
            data = response.json()
            if span.enabled:
                span.end(output=_completion_output(data), usage=_usage_of(data.get("usage")))
                _record_provider_used(trace, provider, i)
            return data

        mapped = _map_gateway_error(response)
        span.fail(mapped).end(metadata={"status_code": response.status_code})
        if _should_fall_back(response) and i < len(providers) - 1:
            last_exc = mapped
            continue
        raise mapped

    assert last_exc is not None  # _require_providers guarantees at least one iteration
    raise last_exc


async def _drain(
    client: httpx.AsyncClient,
    response: httpx.Response,
    span: tracing.Span | None = None,
    started: float = 0.0,
) -> AsyncIterator[bytes]:
    observer = StreamObserver(started) if span is not None and span.enabled else None
    completed = False
    try:
        async for chunk in response.aiter_bytes():
            if observer is not None:
                observer.feed(chunk)
            yield chunk
        completed = True
    except Exception as exc:
        if span is not None:
            span.fail(exc)
        raise
    finally:
        await response.aclose()
        await client.aclose()
        if span is not None and observer is not None:
            span.end(
                output=observer.text or None,
                usage=observer.usage,
                ttft_ms=observer.first_token_ms,
                metadata={
                    "total_ms": round((time.perf_counter() - started) * 1000, 1),
                    # A visitor closing the widget mid-reply ends the stream early.
                    **({} if completed else {"aborted": True}),
                },
            )


async def open_stream(
    messages: list[dict[str, Any]],
    *,
    model_kind: str,
    fallback_messages: list[dict[str, Any]] | None = None,
) -> AsyncIterator[bytes]:
    """Connects to a provider and confirms a successful status *before*
    returning, trying the next configured provider on a 429/5xx.

    This matters because of how StreamingResponse works: Starlette sends the
    HTTP status line before it starts consuming the body iterator, so an
    error raised from inside a generator can no longer change the response
    status -- the client already got "200 OK" and just sees the stream end
    early. Doing the provider trial and status check here, as a plain
    coroutine the router awaits before constructing StreamingResponse, means
    a final failure raises a real HTTPException (503/429/502) instead of a
    broken empty stream.
    """
    providers = _require_providers(model_kind)
    last_exc: HTTPException | None = None
    trace = tracing.current_trace()

    for i, provider in enumerate(providers):
        body = {"model": provider.model, "messages": _pick_messages(messages, fallback_messages, i), "stream": True}
        span = _llm_span(trace, provider, body, model_kind=model_kind, attempt=i)
        started = time.perf_counter()
        client = httpx.AsyncClient(timeout=_TIMEOUT)
        try:
            request = client.build_request("POST", provider.base_url, headers=_headers(provider.api_key), json=body)
            response = await client.send(request, stream=True)
        except httpx.HTTPError as exc:
            await client.aclose()
            span.fail(exc).end()
            last_exc = HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI gateway request failed")
            if i < len(providers) - 1:
                continue
            raise last_exc from exc

        if response.is_success:
            # The span stays open: _drain ends it when the stream does.
            _record_provider_used(trace, provider, i)
            return _drain(client, response, span, started)

        await response.aread()
        mapped = _map_gateway_error(response)
        span.fail(mapped).end(metadata={"status_code": response.status_code})
        await response.aclose()
        await client.aclose()
        if _should_fall_back(response) and i < len(providers) - 1:
            last_exc = mapped
            continue
        raise mapped

    assert last_exc is not None
    raise last_exc
