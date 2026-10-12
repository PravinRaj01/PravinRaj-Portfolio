# app/services/chat_stream.py -- chatbot navigation (AI v2, Phase 2).
#
# The chat model is given a `navigate_to` tool. When a visitor asks to *see*
# something ("show me your React projects"), the model calls it instead of (or
# as well as) answering in text. This module sits between the LLM gateway and
# the browser and turns that tool call into a small `action` event in the SSE
# stream, which the chat widget then performs as a route change:
#
#   data: {"choices":[{"delta":{"content":"Here are the React projects!"}}]}
#   data: {"type":"action","action":"navigate","page":"projects","search":"React",...}
#   data: [DONE]
#
# Why a re-emitter and not a pass-through: the model's tool call is untrusted
# output. It is validated here (page must be one of a fixed set, free text is
# cleaned and capped, a slug can only come from our own database), and the
# provider-specific tool-call chunks -- including Gemini's large opaque
# `thought_signature` blob -- are stripped so they never reach the browser.
#
# Everything is single-pass: the tool call is not sent back to the model for a
# second round. Both Gemini and Groq return a tool call with no text, so when the
# reply has no text of its own the tool's `announcement` is emitted as the
# visible message.
import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, replace
from typing import Any

from sqlalchemy import func, or_, select

from app.models.academic import Experience
from app.models.projects import Project
from app.services import tracing
from app.services.ai_gateway import StreamObserver

logger = logging.getLogger(__name__)

PAGES = ("home", "projects", "experience", "academic", "contact", "podcast")
MODES = ("professional", "creative")
NAVIGATE_TOOL_NAME = "navigate_to"

_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]+")
_LOOKUP_TIMEOUT_SECONDS = 3.0
_NOT_SURE = "I'm not sure which page you meant -- could you tell me which one you'd like to see?"

NAVIGATE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": NAVIGATE_TOOL_NAME,
        "description": (
            "Take the visitor to a page of this portfolio website. Call it only when the visitor "
            "asks to see, open or go to something (a page, a list of projects, one project or one "
            "job). Never call it for an ordinary question -- answer those in text."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "enum": list(PAGES),
                    "description": "Which page to open.",
                },
                "search": {
                    "type": "string",
                    "description": (
                        "For the projects page: a technology or keyword to filter by (e.g. 'React'). "
                        "To open one specific project or job, give its exact title. Optional."
                    ),
                },
                "mode": {
                    "type": "string",
                    "enum": list(MODES),
                    "description": "Only if the visitor clearly asks for the professional or the creative side.",
                },
                "announcement": {
                    "type": "string",
                    "description": "One short, friendly sentence shown to the visitor, e.g. 'Here are the React projects!'",
                },
            },
            "required": ["page", "announcement"],
        },
    },
}


@dataclass(frozen=True)
class NavigateAction:
    page: str
    announcement: str
    mode: str | None = None
    search: str | None = None
    slug: str | None = None

    def event(self) -> dict[str, Any]:
        return {
            "type": "action",
            "action": "navigate",
            "page": self.page,
            "mode": self.mode,
            "search": self.search,
            "slug": self.slug,
            "announcement": self.announcement,
        }


def _clean(value: Any, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(_CONTROL.sub(" ", value).split())[:limit].strip()
    return text or None


def parse_navigate_call(arguments: str) -> NavigateAction | None:
    """Validates a tool call's raw JSON arguments. None means "don't act on it"."""
    try:
        args = json.loads(arguments)
    except ValueError:
        return None
    if not isinstance(args, dict):
        return None
    page = args.get("page")
    if not isinstance(page, str) or page not in PAGES:
        return None
    mode = args.get("mode")
    return NavigateAction(
        page=page,
        mode=mode if isinstance(mode, str) and mode in MODES else None,
        # Only the projects and experience pages use it (a filter, or an exact title to open).
        search=_clean(args.get("search"), 60) if page in ("projects", "experience") else None,
        announcement=_clean(args.get("announcement"), 160) or f"Taking you to the {page} page.",
    )


def first_navigate_action(tool_calls: list[dict[str, str]]) -> NavigateAction | None:
    for call in tool_calls:
        if call.get("name") == NAVIGATE_TOOL_NAME:
            action = parse_navigate_call(call.get("arguments") or "")
            if action is not None:
                return action
    return None


# --- slug lookup: only our own database may produce a slug -----------------------

SlugResolver = Callable[[str, str, str | None, str], Awaitable[str | None]]


async def lookup_slug(page: str, search: str, mode: str | None, content_mode: str) -> str | None:
    """An exact (case-insensitive) title match, and only if it is unique. Uses
    its own short session: this runs while the reply is streaming, when the
    request's session may already be closed. Any failure means "no slug", so a
    database hiccup downgrades to a plain page navigation."""
    from app.db.session import SessionLocal

    wanted_mode = mode or (content_mode if content_mode in MODES else None)
    needle = search.lower()
    try:
        async with SessionLocal() as db:
            if page == "projects":
                stmt = select(Project.slug).where(func.lower(Project.title) == needle, Project.is_active.is_(True))
                if wanted_mode:
                    stmt = stmt.where(Project.mode == wanted_mode)
            else:
                stmt = select(Experience.slug).where(
                    or_(func.lower(Experience.title) == needle, func.lower(Experience.company) == needle)
                )
                if wanted_mode:
                    stmt = stmt.where(Experience.mode == wanted_mode)
            slugs = list((await db.execute(stmt.limit(3))).scalars().all())
    except Exception:
        logger.warning("navigation slug lookup failed", exc_info=True)
        return None
    if len(slugs) == 1 and slugs[0] and _SLUG.match(slugs[0]):
        return slugs[0]
    return None


async def _resolve(resolver: SlugResolver, action: NavigateAction, content_mode: str) -> str | None:
    if action.page not in ("projects", "experience") or not action.search:
        return None
    try:
        slug = await asyncio.wait_for(
            resolver(action.page, action.search, action.mode, content_mode), timeout=_LOOKUP_TIMEOUT_SECONDS
        )
    except Exception:  # incl. timeout: navigation still works, just one level up
        logger.warning("navigation slug resolution failed", exc_info=True)
        return None
    return slug if isinstance(slug, str) and _SLUG.match(slug) else None


# --- the stream ----------------------------------------------------------------------


def _sse(event: dict[str, Any]) -> bytes:
    return b"data: " + json.dumps(event, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n\n"


def _content_event(text: str) -> dict[str, Any]:
    return {"choices": [{"delta": {"content": text}}]}


# Provider internals that are of no use to the browser: the tool call itself
# (it becomes the `action` event), Gemini's opaque thought_signature blobs, and
# Groq's reasoning deltas -- the model's chain of thought, which can quote the
# system prompt and portfolio context.
_PRIVATE_DELTA_KEYS = ("tool_calls", "extra_content", "reasoning", "reasoning_content", "channel")


def _for_browser(event: dict[str, Any]) -> dict[str, Any] | None:
    """The event as the chat widget should see it: reply text, finish markers
    and usage only. None when nothing is left worth sending."""
    choices = event.get("choices")
    if not isinstance(choices, list):
        return event
    has_usage = bool(event.get("usage"))
    kept = []
    for choice in choices:
        if not isinstance(choice, dict) or not isinstance(choice.get("delta"), dict):
            kept.append(choice)
            continue
        delta = {k: v for k, v in choice["delta"].items() if k not in _PRIVATE_DELTA_KEYS}
        if delta.get("content") or choice.get("finish_reason"):
            kept.append({**choice, "delta": delta})
    if not kept and not has_usage:
        return None
    return {**event, "choices": kept}


def navigation_stream(
    upstream: Any, *, content_mode: str, resolver: SlugResolver | None = None
) -> AsyncIterator[bytes]:
    """Wraps the gateway's reply stream. Text events pass through; the model's
    `navigate_to` call becomes an `action` event just before `[DONE]`."""
    # Captured now (inside the request) rather than when the generator first
    # runs, so the trace is the right one however the response is scheduled.
    return _navigation_stream(upstream, content_mode, resolver or lookup_slug, tracing.current_trace())


async def _navigation_stream(
    upstream: Any, content_mode: str, resolver: SlugResolver, trace: tracing.Trace
) -> AsyncIterator[bytes]:
    observer = StreamObserver(time.perf_counter())
    try:
        if hasattr(upstream, "__aiter__"):
            async for chunk in upstream:
                for event in observer.feed(chunk):
                    forward = _for_browser(event)
                    if forward is not None:
                        yield _sse(forward)
        else:
            for chunk in upstream:
                for event in observer.feed(chunk):
                    forward = _for_browser(event)
                    if forward is not None:
                        yield _sse(forward)
    finally:
        closer = getattr(upstream, "aclose", None)
        if closer is not None:
            try:
                await closer()
            except Exception:
                logger.debug("closing the upstream reply failed", exc_info=True)

    calls = observer.tool_calls
    if calls:
        has_text = bool(observer.text.strip())
        action = first_navigate_action(calls)
        if action is None:
            # The model called something we won't act on. Never leave the reply empty.
            trace.tag("navigate_rejected")
            trace.meta(rejected_tool_calls=[{"name": c["name"], "arguments": c["arguments"][:300]} for c in calls])
            if not has_text:
                yield _sse(_content_event(_NOT_SURE))
        else:
            with trace.span("navigate_to", type="tool", input={"arguments": calls[0]["arguments"]}) as span:
                slug = await _resolve(resolver, action, content_mode)
                action = replace(
                    action,
                    slug=slug,
                    # A filter only makes sense on the list; once a single item is found we open it.
                    search=action.search if action.page == "projects" and slug is None else None,
                )
                span.set(output=action.event())
            trace.tag("navigate")
            trace.meta(action_page=action.page, action_search=action.search, action_slug=action.slug)
            if not has_text:
                yield _sse(_content_event(action.announcement))
            yield _sse(action.event())

    yield b"data: [DONE]\n\n"
