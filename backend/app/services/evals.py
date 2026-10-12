# app/services/evals.py -- the scoring core for the offline chatbot evaluations
# (AI v2, Phase 6). Pure functions: no network, no database, no Opik. The
# scripts under backend/scripts/ do the I/O and call into this.
#
# What is measured, and why these measures:
#   * Retrieval (hit@1, hit@k, MRR) -- did the hybrid search surface the entry
#     the question is about? Deterministic and free: it needs no model call, so
#     it can run on every change to the index or the search.
#   * Answer relevance and groundedness -- an LLM judge reads the question, the
#     answer and (for groundedness) the context the chatbot was given. These are
#     the two failure modes that matter for a portfolio bot: not answering the
#     question, and stating things the portfolio doesn't say. They are judged by
#     the project's own gateway (Gemini, Groq as fallback), so there is nothing
#     extra to install or pay for. Groundedness is the inverse of Opik's
#     "Hallucination" metric (1 = fully supported), so that higher is better for
#     every number shown.
import json
import statistics
from dataclasses import dataclass, field
from typing import Any

# --- retrieval -------------------------------------------------------------------------------


@dataclass(frozen=True)
class Expected:
    """What a good retrieval contains. Exactly one of the two is set.

    `title`: a case-insensitive substring of a retrieved chunk's title, e.g.
    "ViralAutomator" or "Acme". `source_type`: the kind of entry, e.g.
    "education" or "skills", for questions that have no single named entry.
    """

    title: str | None = None
    source_type: str | None = None

    def matches(self, title: str | None, source_type: str | None) -> bool:
        if self.title is not None:
            return bool(title) and self.title.strip().lower() in (title or "").lower()
        if self.source_type is not None:
            return source_type == self.source_type
        return False

    def to_dict(self) -> dict[str, str]:
        return {"title": self.title} if self.title is not None else {"source_type": self.source_type or ""}


@dataclass(frozen=True)
class RetrievalOutcome:
    hit_at_k: bool
    hit_at_1: bool
    rank: int | None  # 1-based position of the best match, None if not retrieved
    reciprocal_rank: float


def retrieval_outcome(
    expected: list[Expected], retrieved: list[tuple[str | None, str | None]], *, k: int
) -> RetrievalOutcome:
    """`retrieved` is the search result in rank order as (title, source_type).
    Any one of the expectations matching counts: some questions are answered by
    more than one entry."""
    rank: int | None = None
    for position, (title, source_type) in enumerate(retrieved[:k], start=1):
        if any(e.matches(title, source_type) for e in expected):
            rank = position
            break
    return RetrievalOutcome(
        hit_at_k=rank is not None,
        hit_at_1=rank == 1,
        rank=rank,
        reciprocal_rank=1.0 / rank if rank else 0.0,
    )


# --- LLM judge -------------------------------------------------------------------------------

JUDGE_TOOL_NAME = "report_score"
JUDGE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": JUDGE_TOOL_NAME,
        "description": "Report the score for the answer.",
        "parameters": {
            "type": "object",
            "properties": {
                "score": {"type": "number", "description": "A number from 0 to 1, as defined in the instructions."},
                "reason": {"type": "string", "description": "One short sentence explaining the score."},
            },
            "required": ["score", "reason"],
        },
    },
}

_RELEVANCE_RUBRIC = """You are grading the answer of a chatbot on a developer's portfolio website.

Score ANSWER RELEVANCE from 0 to 1: how directly and completely the answer addresses the visitor's question.
- 1.0: answers the question fully and stays on topic.
- 0.5: partly answers it, or is vague, or buries the answer in unrelated detail.
- 0.0: does not address the question, or refuses to answer something it plainly could.
Honestly saying that a requested detail is not available is a legitimate answer: score it by whether the
rest of the answer is still helpful. Do not judge whether the facts are true; only whether the answer is on point."""

_GROUNDEDNESS_RUBRIC = """You are checking a chatbot's answer on a developer's portfolio website for made-up claims.

CONTEXT is the only information the chatbot was given. Score GROUNDEDNESS from 0 to 1:
- 1.0: every factual claim in the answer is supported by the context (paraphrase is fine), or the answer
  honestly says it does not have the information.
- 0.5: mostly supported, but with one or two claims that go beyond the context.
- 0.0: contains specific claims (names, numbers, employers, technologies, dates) that the context does not
  support, or contradicts it.
Greetings, pointers to a page, and offers of further help are not factual claims."""


def relevance_messages(question: str, answer: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": _RELEVANCE_RUBRIC + f"\nCall {JUDGE_TOOL_NAME} with your score."},
        {"role": "user", "content": f"QUESTION:\n{question}\n\nANSWER:\n{answer}"},
    ]


def groundedness_messages(question: str, answer: str, context: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": _GROUNDEDNESS_RUBRIC + f"\nCall {JUDGE_TOOL_NAME} with your score."},
        {"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION:\n{question}\n\nANSWER:\n{answer}"},
    ]


@dataclass(frozen=True)
class Judgement:
    score: float
    reason: str


def parse_judgement(completion: dict[str, Any]) -> Judgement | None:
    """The judge's tool call -> a clamped score. None when it isn't usable, so a
    flaky judge shows up as "not judged" rather than as a made-up number."""
    choices = completion.get("choices") or []
    calls = ((choices[0].get("message") or {}).get("tool_calls") or []) if choices else []
    if not calls or (calls[0].get("function") or {}).get("name") != JUDGE_TOOL_NAME:
        return None
    try:
        args = json.loads(calls[0]["function"]["arguments"])
        score = float(args["score"])
    except (KeyError, TypeError, ValueError):
        return None
    if score != score or score in (float("inf"), float("-inf")):  # NaN / inf
        return None
    reason = args.get("reason") if isinstance(args, dict) else ""
    return Judgement(score=max(0.0, min(1.0, score)), reason=str(reason or "")[:300])


# --- aggregation -----------------------------------------------------------------------------


@dataclass
class RagItemResult:
    question: str
    expected: list[Expected]
    outcome: RetrievalOutcome
    retrieved_titles: list[str] = field(default_factory=list)
    answer: str = ""
    relevance: Judgement | None = None
    groundedness: Judgement | None = None
    latency_ms: float | None = None
    error: str | None = None


def _mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 4) if values else None


def summarize_rag(results: list[RagItemResult], *, k: int) -> dict[str, Any]:
    """The numbers shown in the admin Evaluations tab. A run's unanswered or
    errored items still count against retrieval (that is a real failure) but
    are simply absent from the judged averages."""
    answered = [r for r in results if r.error is None]
    return {
        "kind": "rag",
        "items": len(results),
        "k": k,
        "hit_at_1": _mean([float(r.outcome.hit_at_1) for r in results]),
        "hit_at_k": _mean([float(r.outcome.hit_at_k) for r in results]),
        "mrr": _mean([r.outcome.reciprocal_rank for r in results]),
        "answer_relevance": _mean([r.relevance.score for r in answered if r.relevance]),
        "groundedness": _mean([r.groundedness.score for r in answered if r.groundedness]),
        "judged": sum(1 for r in answered if r.relevance and r.groundedness),
        "errors": len(results) - len(answered),
        "latency_ms_avg": (
            round(statistics.fmean(latencies), 1)
            if (latencies := [r.latency_ms for r in answered if r.latency_ms is not None])
            else None
        ),
        "misses": [r.question for r in results if not r.outcome.hit_at_k][:10],
    }


@dataclass
class GuardRow:
    message: str
    label: str  # "legit" | "injection" | "off_topic"
    blocked: bool


def summarize_guard(rows: list[GuardRow]) -> dict[str, Any]:
    """Recall on injections, wrongly blocked legitimate messages, and overall accuracy."""
    legit = [r for r in rows if r.label == "legit"]
    injections = [r for r in rows if r.label == "injection"]
    off_topic = [r for r in rows if r.label == "off_topic"]
    caught = sum(r.blocked for r in injections)
    false_positives = sum(r.blocked for r in legit)
    # "correct" = legit passed, injection blocked; off-topic isn't judged (the guard leaves it to the LLM).
    judged = legit + injections
    correct = sum(1 for r in judged if r.blocked == (r.label == "injection"))
    return {
        "kind": "guard",
        "items": len(rows),
        "legit": len(legit),
        "injections": len(injections),
        "injection_recall": round(caught / len(injections), 4) if injections else None,
        "injections_caught": caught,
        "false_positive_rate": round(false_positives / len(legit), 4) if legit else None,
        "false_positives": false_positives,
        "accuracy": round(correct / len(judged), 4) if judged else None,
        "off_topic_blocked": sum(r.blocked for r in off_topic),
        "off_topic": len(off_topic),
        "missed_injections": [r.message for r in injections if not r.blocked][:10],
        "wrongly_blocked": [r.message for r in legit if r.blocked][:10],
    }
