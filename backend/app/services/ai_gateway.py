# app/services/ai_gateway.py — MIGRATION_PLAN.md §7 "stubs" row.
#
# Thin wrapper around the same Lovable AI gateway the three original Edge
# Functions called (https://ai.gateway.lovable.dev/v1/chat/completions, an
# OpenAI-compatible endpoint). LOVABLE_API_KEY is unset in this environment
# (MIGRATION_PLAN.md §13) -- every call here raises AIGatewayNotConfiguredError
# until a real key is added to backend/.env, so the routes built on top of
# this can return a clean 503 instead of a raw connection/auth failure.
from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"


class AIGatewayNotConfiguredError(RuntimeError):
    pass


def _require_key() -> str:
    if not settings.lovable_api_key:
        raise AIGatewayNotConfiguredError("LOVABLE_API_KEY is not configured")
    return settings.lovable_api_key


def _map_gateway_error(response: httpx.Response) -> HTTPException:
    if response.status_code == 429:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI is temporarily busy. Please try again in a minute.",
        )
    if response.status_code == 402:
        return HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="AI usage limit reached. Please try again later.",
        )
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI gateway request failed")


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: dict[str, Any] | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    api_key = _require_key()
    body: dict[str, Any] = {"model": model, "messages": messages, "stream": False}
    if max_tokens is not None:
        body["max_tokens"] = max_tokens
    if tools is not None:
        body["tools"] = tools
    if tool_choice is not None:
        body["tool_choice"] = tool_choice

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            _GATEWAY_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )
    if not response.is_success:
        raise _map_gateway_error(response)
    return response.json()


async def stream_chat_completion(
    messages: list[dict[str, Any]], *, model: str
) -> AsyncIterator[bytes]:
    api_key = _require_key()
    body = {"model": model, "messages": messages, "stream": True}

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            _GATEWAY_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        ) as response:
            if not response.is_success:
                await response.aread()
                raise _map_gateway_error(response)
            async for chunk in response.aiter_bytes():
                yield chunk
