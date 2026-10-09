# app/services/chat_guard.py -- a free, no-extra-API-call guard for the public
# chatbot. Each visitor message is already embedded for RAG; this compares that
# same vector to labelled examples (chat_guard_examples.py) and, when the
# message is clearly a jailbreak or clearly off-topic, lets the caller answer
# with a fixed redirect instead of running a search and an LLM call.
#
# Design rules:
#  * Default is ALLOW. A message is blocked only when it is confidently closer
#    to the bad examples than to any real portfolio question.
#  * FAIL OPEN. A missing, stale or mismatched example index disables the guard
#    rather than risk misclassifying visitors against the wrong vectors.
#  * Pure Python (no numpy): ~80 dot products of 768 floats.
import base64
import hashlib
import json
import logging
import operator
from array import array
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings
from app.services import embeddings
from app.services.chat_guard_examples import (
    EXAMPLES,
    LABEL_INJECTION,
    LABEL_OFF_TOPIC,
    LABEL_PORTFOLIO,
)

logger = logging.getLogger(__name__)

INDEX_PATH = Path(__file__).with_name("chat_guard_index.json")

# One text for every kind of block, so it doesn't reveal what was detected.
REDIRECT_REPLY = (
    "I'm here to help with questions about this portfolio: projects, skills, "
    "experience, services, or how to get in touch. What would you like to know?"
)


@dataclass(frozen=True)
class Thresholds:
    min_sim: float
    margin: float


@dataclass(frozen=True)
class GuardDecision:
    block: bool
    label: str  # the label that triggered a block; otherwise "portfolio"
    best: dict[str, float]  # similarity to the nearest example of each label


def examples_hash(model: str, task_type: str, dims: int) -> str:
    """Identifies exactly which texts + embedding setup the index was built from."""
    payload = json.dumps(
        {"model": model, "task_type": task_type, "dims": dims, "examples": EXAMPLES},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def current_examples_hash() -> str:
    return examples_hash(
        settings.gemini_embedding_model, embeddings.TASK_QUERY, embeddings.EMBEDDING_DIMS
    )


def encode_vector(values: list[float]) -> str:
    return base64.b64encode(array("f", values).tobytes()).decode("ascii")


def decode_vector(encoded: str) -> array:
    vec = array("f")
    vec.frombytes(base64.b64decode(encoded))
    return vec


def _dot(a, b) -> float:
    return sum(map(operator.mul, a, b))


def similarity_by_label(vector: list[float], index: list[tuple[str, array]]) -> dict[str, float]:
    """Cosine similarity to the nearest example of each label (all vectors are
    unit length, so the dot product is the cosine)."""
    best: dict[str, float] = {}
    for label, example in index:
        sim = _dot(vector, example)
        if sim > best.get(label, -1.0):
            best[label] = sim
    return best


def decide(
    best: dict[str, float], injection: Thresholds, off_topic: Thresholds | None
) -> GuardDecision:
    """Pure decision rule, shared by the live guard and the eval script."""
    portfolio = best.get(LABEL_PORTFOLIO, 0.0)
    candidates: list[tuple[float, str]] = []
    for label, thresholds in ((LABEL_INJECTION, injection), (LABEL_OFF_TOPIC, off_topic)):
        if thresholds is None or label not in best:
            continue
        margin = best[label] - portfolio
        if best[label] >= thresholds.min_sim and margin >= thresholds.margin:
            candidates.append((margin, label))
    if candidates:
        return GuardDecision(block=True, label=max(candidates)[1], best=best)
    return GuardDecision(block=False, label=LABEL_PORTFOLIO, best=best)


_UNSET = object()
_index_cache: object = _UNSET


def _load_index() -> list[tuple[str, array]] | None:
    """Loads and validates the precomputed example vectors once per process.
    Returns None (guard disabled) if anything is off."""
    global _index_cache
    if _index_cache is not _UNSET:
        return _index_cache  # type: ignore[return-value]

    result: list[tuple[str, array]] | None = None
    try:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        problems = []
        if data.get("model") != settings.gemini_embedding_model:
            problems.append("embedding model changed")
        if data.get("dims") != embeddings.EMBEDDING_DIMS:
            problems.append("dimensions changed")
        if data.get("task_type") != embeddings.TASK_QUERY:
            problems.append("task type changed")
        if data.get("examples_hash") != current_examples_hash():
            problems.append("examples changed since the index was built")
        if problems:
            logger.warning(
                "Chat guard disabled: %s. Re-run scripts/build_chat_guard_index.py.",
                ", ".join(problems),
            )
        else:
            result = [(item["label"], decode_vector(item["vec"])) for item in data["vectors"]]
    except (OSError, ValueError, KeyError, TypeError):
        logger.warning("Chat guard disabled: example index missing or unreadable", exc_info=True)

    _index_cache = result
    return result


def classify(vector: list[float]) -> GuardDecision:
    """Fail-open classification of one message embedding."""
    index = _load_index()
    if index is None or len(vector) != embeddings.EMBEDDING_DIMS:
        return GuardDecision(block=False, label=LABEL_PORTFOLIO, best={})
    off_topic = (
        Thresholds(settings.chat_guard_offtopic_min_sim, settings.chat_guard_offtopic_margin)
        if settings.chat_guard_offtopic_enabled
        else None
    )
    return decide(
        similarity_by_label(vector, index),
        Thresholds(settings.chat_guard_injection_min_sim, settings.chat_guard_injection_margin),
        off_topic,
    )


async def redirect_stream() -> AsyncIterator[bytes]:
    """The fixed reply, in the same OpenAI-style SSE format the chat widget
    already parses, so the frontend needs no special case."""
    chunk = {"choices": [{"delta": {"content": REDIRECT_REPLY}}]}
    yield f"data: {json.dumps(chunk)}\n\n".encode("utf-8")
    yield b"data: [DONE]\n\n"
