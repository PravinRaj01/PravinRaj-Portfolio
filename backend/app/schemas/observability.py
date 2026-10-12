# app/schemas/observability.py -- response/request shapes for the admin "AI"
# console (app/api/routers/observability.py). Opik's trace input/output/metadata
# are free-form JSON, so those fields are typed Any.
from typing import Any, Literal

from pydantic import BaseModel, Field

RangeKey = Literal["24h", "7d", "30d"]
TraceTag = Literal["chat", "admin", "blocked", "fallback", "navigate", "voice", "error", "span_error", "rag_fallback"]


class StatusResponse(BaseModel):
    configured: bool  # an API key is set, so Opik can be read
    tracing_enabled: bool  # OPIK_ENABLED: whether new traces are being sent
    project: str
    workspace: str | None = None
    dashboard_url: str | None = None


class Metric(BaseModel):
    value: float | None = None
    previous: float | None = None  # same measure over the equally long period before


class SummaryResponse(BaseModel):
    range: RangeKey
    generated_at: str
    sample_size: int
    truncated: bool
    by_name: dict[str, int]
    traces: Metric
    chats: Metric
    admin_calls: Metric
    errors: Metric
    blocked: Metric
    blocked_rate: Metric
    fallback_rate: Metric
    navigate: Metric
    voice_share: Metric
    rag_fallback: Metric
    latency_p50_ms: Metric
    latency_p90_ms: Metric
    ttft_avg_ms: Metric
    tokens_total: Metric
    tokens_avg_per_chat: Metric
    cost_usd: Metric
    rating_avg: Metric
    ratings_up: Metric
    ratings_down: Metric


class TimePoint(BaseModel):
    time: str
    traces: int
    chats: int
    blocked: int
    errors: int
    tokens: int
    latency_p50_ms: float | None = None
    latency_p90_ms: float | None = None
    ttft_avg_ms: float | None = None


class TimeseriesResponse(BaseModel):
    range: RangeKey
    interval: Literal["hour", "day"]
    truncated: bool
    points: list[TimePoint]


class TraceRow(BaseModel):
    id: str | None = None
    name: str | None = None
    started_at: str | None = None
    duration_ms: float | None = None
    ttft_ms: float | None = None
    tokens: int | None = None
    provider: str | None = None
    model: str | None = None
    path: str | None = None
    tags: list[str] = Field(default_factory=list)
    error: bool = False
    error_message: str | None = None
    input_preview: str | None = None
    output_preview: str | None = None
    rating: float | None = None
    guard_correct: float | None = None


class TracesPage(BaseModel):
    rows: list[TraceRow]
    page: int
    size: int
    total: int


class SpanDetail(BaseModel):
    id: str | None = None
    name: str | None = None
    type: str | None = None
    started_at: str | None = None
    offset_ms: float | None = None
    duration_ms: float | None = None
    input: Any = None
    output: Any = None
    metadata: Any = None
    model: str | None = None
    provider: str | None = None
    usage: dict[str, int] | None = None
    ttft_ms: float | None = None
    error_message: str | None = None
    error_type: str | None = None


class TraceScore(BaseModel):
    name: str | None = None
    value: float | None = None
    reason: str | None = None


class TraceDetail(TraceRow):
    project_id: str | None = None
    input: Any = None
    output: Any = None
    metadata: Any = None
    usage: dict[str, int] | None = None
    cost_usd: float | None = None
    scores: list[TraceScore] = Field(default_factory=list)
    spans: list[SpanDetail] = Field(default_factory=list)


class FeedbackRequest(BaseModel):
    # admin_rating: was this reply good (1) or bad (0)?
    # guard_correct: was this guard decision right (1) or wrong (0)?
    name: Literal["admin_rating", "guard_correct"] = "admin_rating"
    score: Literal[0, 1]
    comment: str | None = Field(default=None, max_length=500)
