# app/services/observability.py -- turns Opik traces into the numbers the admin
# "AI" tab shows (AI v2, Phase 1b).
#
# Everything here works on the plain trace dicts Opik returns, aggregated in
# Python. That is deliberate: a portfolio's traffic is a few hundred traces a
# month, the TracePublic fields (tags, duration, ttft, usage, feedback_scores)
# are well defined, and computing locally avoids depending on Opik's stats
# endpoint, whose stat names and value types aren't documented. If a window
# ever holds more than MAX_TRACES, the figures cover the newest MAX_TRACES and
# the response says so (`truncated`).
import asyncio
import json
import math
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services import opik_api

RANGES: dict[str, timedelta] = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}
CACHE_TTL_SECONDS = 30.0

RATING_NAME = "admin_rating"
GUARD_NAME = "guard_correct"


# --- window fetch + cache -----------------------------------------------------------


@dataclass
class Window:
    range_key: str
    start: datetime
    end: datetime
    current: list[dict[str, Any]]
    previous: list[dict[str, Any]]
    truncated: bool
    fetched_at: float = field(default_factory=time.monotonic)


_cache: dict[str, Window] = {}


def clear_cache() -> None:
    _cache.clear()


async def get_window(range_key: str) -> Window:
    """The traces of the last `range_key` and of the equally long period before
    it (for "vs previous" deltas). Cached briefly: the tab fires several
    requests at once and a trace list doesn't need to be live to the second."""
    cached = _cache.get(range_key)
    if cached is not None and time.monotonic() - cached.fetched_at < CACHE_TTL_SECONDS:
        return cached
    now = datetime.now(timezone.utc)
    span = RANGES[range_key]
    (current, cut_current), (previous, cut_previous) = await asyncio.gather(
        opik_api.fetch_traces(now - span, now),
        opik_api.fetch_traces(now - 2 * span, now - span),
    )
    window = Window(range_key, now - span, now, current, previous, cut_current or cut_previous)
    _cache[range_key] = window
    return window


# --- small helpers ---------------------------------------------------------------------


def _tags(trace: dict[str, Any]) -> set[str]:
    return {t for t in trace.get("tags") or [] if isinstance(t, str)}


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def percentile(values: list[float], pct: float) -> float | None:
    """Nearest-rank percentile; None for an empty list."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(pct / 100 * len(ordered)))
    return ordered[min(rank, len(ordered)) - 1]


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _is_chat(trace: dict[str, Any]) -> bool:
    return "chat" in _tags(trace) or trace.get("name") == "chat"


def _is_error(trace: dict[str, Any]) -> bool:
    return "error" in _tags(trace) or bool(trace.get("error_info"))


def _total_tokens(trace: dict[str, Any]) -> int:
    usage = trace.get("usage")
    if not isinstance(usage, dict):
        return 0
    total = _number(usage.get("total_tokens"))
    if total is not None:
        return int(total)
    return int(sum(_number(usage.get(k)) or 0 for k in ("prompt_tokens", "completion_tokens")))


def score_of(trace: dict[str, Any], name: str) -> float | None:
    for score in trace.get("feedback_scores") or []:
        if isinstance(score, dict) and score.get("name") == name:
            return _number(score.get("value"))
    return None


# --- summary ------------------------------------------------------------------------------


def aggregate(traces: list[dict[str, Any]]) -> dict[str, float | None]:
    chats = [t for t in traces if _is_chat(t)]
    blocked = [t for t in chats if "blocked" in _tags(t)]
    answered = len(chats) - len(blocked)  # chats that actually reached the model
    durations = [d for t in chats if (d := _number(t.get("duration"))) is not None]
    ttfts = [v for t in chats if (v := _number(t.get("ttft"))) is not None]
    tokens = [_total_tokens(t) for t in traces]
    chat_tokens = [_total_tokens(t) for t in chats if _total_tokens(t) > 0]
    ratings = [r for t in traces if (r := score_of(t, RATING_NAME)) is not None]
    fallbacks = sum(1 for t in chats if "fallback" in _tags(t))

    def rate(part: int, whole: int) -> float | None:
        return part / whole if whole > 0 else None

    return {
        "traces": float(len(traces)),
        "chats": float(len(chats)),
        "admin_calls": float(sum(1 for t in traces if "admin" in _tags(t))),
        "errors": float(sum(1 for t in traces if _is_error(t))),
        "blocked": float(len(blocked)),
        "blocked_rate": rate(len(blocked), len(chats)),
        "fallback_rate": rate(fallbacks, answered),
        "navigate": float(sum(1 for t in chats if "navigate" in _tags(t))),
        "voice_share": rate(sum(1 for t in chats if "voice" in _tags(t)), len(chats)),
        "rag_fallback": float(sum(1 for t in chats if "rag_fallback" in _tags(t))),
        "latency_p50_ms": percentile(durations, 50),
        "latency_p90_ms": percentile(durations, 90),
        "ttft_avg_ms": _mean(ttfts),
        "tokens_total": float(sum(tokens)),
        "tokens_avg_per_chat": _mean([float(v) for v in chat_tokens]),
        "cost_usd": sum(_number(t.get("total_estimated_cost")) or 0.0 for t in traces),
        "rating_avg": _mean(ratings),
        "ratings_up": float(sum(1 for r in ratings if r >= 0.5)),
        "ratings_down": float(sum(1 for r in ratings if r < 0.5)),
    }


def build_summary(window: Window) -> dict[str, Any]:
    current, previous = aggregate(window.current), aggregate(window.previous)
    metrics = {k: {"value": current[k], "previous": previous[k]} for k in current}
    return {
        "range": window.range_key,
        "generated_at": opik_api.iso(datetime.now(timezone.utc)),
        "sample_size": len(window.current),
        "truncated": window.truncated,
        "by_name": dict(Counter(t.get("name") or "unnamed" for t in window.current).most_common()),
        **metrics,
    }


# --- time series -------------------------------------------------------------------------


def _floor(moment: datetime, hourly: bool) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0) if hourly else moment.replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def build_timeseries(window: Window) -> dict[str, Any]:
    hourly = window.range_key == "24h"
    step = timedelta(hours=1) if hourly else timedelta(days=1)
    buckets: dict[datetime, list[dict[str, Any]]] = {}
    cursor = _floor(window.start, hourly)
    while cursor <= window.end:
        buckets[cursor] = []
        cursor += step
    for trace in window.current:
        started = opik_api.parse_time(trace.get("start_time"))
        if started is None:
            continue
        key = _floor(started, hourly)
        if key in buckets:
            buckets[key].append(trace)

    points = []
    for start, traces in buckets.items():
        agg = aggregate(traces)
        points.append(
            {
                "time": opik_api.iso(start),
                "traces": int(agg["traces"] or 0),
                "chats": int(agg["chats"] or 0),
                "blocked": int(agg["blocked"] or 0),
                "errors": int(agg["errors"] or 0),
                "tokens": int(agg["tokens_total"] or 0),
                "latency_p50_ms": agg["latency_p50_ms"],
                "latency_p90_ms": agg["latency_p90_ms"],
                "ttft_avg_ms": agg["ttft_avg_ms"],
            }
        )
    return {
        "range": window.range_key,
        "interval": "hour" if hourly else "day",
        "truncated": window.truncated,
        "points": points,
    }


# --- trace rows and detail ------------------------------------------------------------------


def _plain(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple)):
        return f"{len(value)} item{'s' if len(value) != 1 else ''}"
    return str(value)


def _preview_text(value: Any) -> str:
    """One human line for a trace's input or output: the visitor's message or the
    reply when there is one, otherwise a short summary of an admin call."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("message", "reply", "content", "description", "query"):
            if isinstance(value.get(key), str) and value[key].strip():
                return value[key]
        data = value.get("data")
        if isinstance(data, dict) and isinstance(data.get("title"), str):
            kind = value.get("entityType")
            return f"{kind}: {data['title']}" if isinstance(kind, str) else data["title"]
        if isinstance(value.get("title"), str):
            return value["title"]
        if isinstance(value.get("theme_hint"), str) and value["theme_hint"].strip():
            return f"theme: {value['theme_hint']}"
        shown = {k: v for k, v in value.items() if v is not None and v != "" and not isinstance(v, dict)}
        if shown:
            return ", ".join(f"{k}={_plain(v)}" for k, v in shown.items())
        if not value or all(v is None or v == "" for v in value.values()):
            return "(defaults)"
    return json.dumps(value, ensure_ascii=False, default=str)


def preview(value: Any, limit: int = 160) -> str | None:
    if value is None:
        return None
    text = " ".join(_preview_text(value).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _meta(trace: dict[str, Any], key: str) -> Any:
    metadata = trace.get("metadata")
    return metadata.get(key) if isinstance(metadata, dict) else None


def trace_row(trace: dict[str, Any]) -> dict[str, Any]:
    error_info = trace.get("error_info") if isinstance(trace.get("error_info"), dict) else None
    return {
        "id": trace.get("id"),
        "name": trace.get("name"),
        "started_at": trace.get("start_time"),
        "duration_ms": _number(trace.get("duration")),
        "ttft_ms": _number(trace.get("ttft")),
        "tokens": _total_tokens(trace) or None,
        "provider": _meta(trace, "provider"),
        "model": _meta(trace, "model"),
        "path": _meta(trace, "path"),
        "tags": sorted(_tags(trace)),
        "error": _is_error(trace),
        "error_message": (error_info or {}).get("message"),
        "input_preview": preview(trace.get("input")),
        "output_preview": preview(trace.get("output")),
        "rating": score_of(trace, RATING_NAME),
        "guard_correct": score_of(trace, GUARD_NAME),
    }


def span_detail(span: dict[str, Any], trace_start: datetime | None) -> dict[str, Any]:
    started = opik_api.parse_time(span.get("start_time"))
    ended = opik_api.parse_time(span.get("end_time"))
    duration = _number(span.get("duration"))
    if duration is None and started and ended:
        duration = (ended - started).total_seconds() * 1000
    error_info = span.get("error_info") if isinstance(span.get("error_info"), dict) else None
    return {
        "id": span.get("id"),
        "name": span.get("name"),
        "type": span.get("type"),
        "started_at": span.get("start_time"),
        "offset_ms": round((started - trace_start).total_seconds() * 1000, 1) if started and trace_start else None,
        "duration_ms": round(duration, 1) if duration is not None else None,
        "input": span.get("input"),
        "output": span.get("output"),
        "metadata": span.get("metadata"),
        "model": span.get("model"),
        "provider": span.get("provider"),
        "usage": span.get("usage"),
        "ttft_ms": _number(span.get("ttft")),
        "error_message": (error_info or {}).get("message") if error_info else None,
        "error_type": (error_info or {}).get("exception_type") if error_info else None,
    }


def trace_detail(trace: dict[str, Any], spans: list[dict[str, Any]]) -> dict[str, Any]:
    start = opik_api.parse_time(trace.get("start_time"))
    ordered = sorted(spans, key=lambda s: str(s.get("start_time") or ""))
    return {
        **trace_row(trace),
        "project_id": trace.get("project_id"),
        "input": trace.get("input"),
        "output": trace.get("output"),
        "metadata": trace.get("metadata"),
        "usage": trace.get("usage"),
        "cost_usd": _number(trace.get("total_estimated_cost")),
        "scores": [
            {"name": s.get("name"), "value": _number(s.get("value")), "reason": s.get("reason")}
            for s in trace.get("feedback_scores") or []
            if isinstance(s, dict)
        ],
        "spans": [span_detail(s, start) for s in ordered],
    }
