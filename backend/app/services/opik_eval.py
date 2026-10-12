# app/services/opik_eval.py -- records an offline evaluation run in Opik as a
# dataset + experiment (AI v2, Phase 6). Used by the scripts under
# backend/scripts/, never by the web app.
#
# How Opik models it (REST, no SDK -- same reasoning as tracing.py):
#   dataset            the questions (one item each)
#   trace              what actually happened for one question; the scripts
#                      create these through tracing.py, tagged "eval"
#   feedback score     a named number on a trace (hit_at_k, groundedness...)
#   experiment         one run: links each dataset item to the trace it produced
# Opik averages the feedback scores of an experiment's traces, which is what its
# own UI shows; the run's own summary is also stored in the experiment's
# metadata so the admin tab doesn't depend on how Opik aggregates.
import logging
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings
from app.services import opik_api, tracing

logger = logging.getLogger(__name__)

_DATASET_ITEM_BATCH = 50


@dataclass
class EvalLogItem:
    """One evaluated question: its dataset row, the trace it produced and its scores."""

    data: dict[str, Any]
    trace_id: str | None = None
    scores: dict[str, float] = field(default_factory=dict)
    reasons: dict[str, str] = field(default_factory=dict)
    dataset_item_id: str = field(default_factory=tracing.new_id)


async def _ensure_dataset(name: str, description: str) -> None:
    try:
        await opik_api._request(
            "POST",
            "v1/private/datasets",
            json_body={"name": name, "description": description},
            expected_statuses=(400, 409),
        )
    except opik_api.OpikUpstreamError as exc:
        # Already exists (or is created implicitly by the item upsert below).
        if exc.status_code not in (400, 409):
            raise


async def log_experiment(
    *,
    name: str,
    dataset_name: str,
    dataset_description: str,
    items: list[EvalLogItem],
    metadata: dict[str, Any],
) -> str:
    """Writes the run to Opik and returns the experiment id. Raises
    OpikNotConfiguredError / OpikUpstreamError; callers decide whether a failed
    log should fail the run (the scripts just report it and keep the results)."""
    if not opik_api.is_configured():
        raise opik_api.OpikNotConfiguredError("OPIK_API_KEY is not set")

    await _ensure_dataset(dataset_name, dataset_description)
    for start in range(0, len(items), _DATASET_ITEM_BATCH):
        batch = items[start : start + _DATASET_ITEM_BATCH]
        await opik_api._request(
            "PUT",
            "v1/private/datasets/items",
            json_body={
                "dataset_name": dataset_name,
                "items": [{"id": i.dataset_item_id, "source": "sdk", "data": i.data} for i in batch],
            },
        )

    scores = [
        {
            "id": i.trace_id,
            "project_name": settings.opik_project_name,
            "name": score_name,
            "value": float(value),
            "source": "sdk",
            **({"reason": i.reasons[score_name]} if score_name in i.reasons else {}),
        }
        for i in items
        if i.trace_id
        for score_name, value in i.scores.items()
    ]
    for start in range(0, len(scores), 100):
        await opik_api._request(
            "PUT", "v1/private/traces/feedback-scores", json_body={"scores": scores[start : start + 100]}
        )

    experiment_id = tracing.new_id()
    await opik_api._request(
        "POST",
        "v1/private/experiments",
        json_body={
            "id": experiment_id,
            "dataset_name": dataset_name,
            "name": name,
            "type": "regular",
            "metadata": metadata,
        },
    )
    linked = [
        {"experiment_id": experiment_id, "dataset_item_id": i.dataset_item_id, "trace_id": i.trace_id}
        for i in items
        if i.trace_id
    ]
    if linked:
        await opik_api._request("POST", "v1/private/experiments/items", json_body={"experiment_items": linked})
    await opik_api._request("POST", "v1/private/experiments/finish", json_body={"ids": [experiment_id]})
    return experiment_id
