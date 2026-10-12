# app/services/embeddings.py -- RAG_MIGRATION_PLAN.md §7. Gemini's *native*
# embedding endpoints (not the OpenAI-compatible layer, which doesn't expose
# dimensions or task type). Groq has no embeddings API, so there's no
# provider fallback here: callers catch RagUnavailableError and use the full
# portfolio context instead.
import asyncio
import hashlib
import math

import httpx

from app.core.config import settings
from app.services import tracing

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"
TASK_QUERY = "RETRIEVAL_QUERY"
EMBEDDING_DIMS = 768
_BATCH_SIZE = 50
_RATE_LIMIT_WAIT_SECONDS = 25.0  # only used when a caller opts in to retries


class RagUnavailableError(RuntimeError):
    """Retrieval can't run for this request -- the caller must fall back to
    the full portfolio context."""


class EmbeddingUnavailableError(RagUnavailableError):
    """No embedding could be produced (missing key, quota, network, 4xx/5xx)."""


class EmbeddingRateLimitedError(EmbeddingUnavailableError):
    """HTTP 429. The free tier counts every item in a batch toward its
    100 requests/minute limit, so a big batch right after another one can trip it."""


def content_hash(text_: str) -> str:
    return hashlib.sha256(text_.encode("utf-8")).hexdigest()


def l2_normalize(values: list[float]) -> list[float]:
    """gemini-embedding-001 only returns unit vectors at its full 3072 dims.
    We ask for 768, so normalising here is required for cosine distance to be
    meaningful."""
    norm = math.sqrt(sum(v * v for v in values))
    return values if norm == 0.0 else [v / norm for v in values]


def to_pgvector(values: list[float]) -> str:
    """pgvector text literal. Sent as a bound *text* parameter and cast in SQL
    (CAST(CAST(:v AS text) AS vector)), which avoids registering an asyncpg
    codec on every new NullPool connection."""
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


async def _post(client: httpx.AsyncClient, path: str, payload: dict) -> dict:
    response = await client.post(
        f"{_BASE}/{settings.gemini_embedding_model}:{path}",
        headers={"x-goog-api-key": settings.gemini_api_key},
        json=payload,
    )
    if response.status_code >= 400:
        error_class = (
            EmbeddingRateLimitedError if response.status_code == 429 else EmbeddingUnavailableError
        )
        raise error_class(f"{path} failed: HTTP {response.status_code} {response.text[:300]}")
    return response.json()


async def embed_query(text_: str) -> list[float]:
    # Traced (see tracing.py): a no-op unless Opik is configured. Only the
    # size of the text is recorded -- the query itself is already on the trace.
    with tracing.current_trace().span("embed_query", input={"chars": len(text_)}) as span:
        span.set(
            model=settings.gemini_embedding_model,
            provider="gemini",
            metadata={"dims": EMBEDDING_DIMS, "task_type": TASK_QUERY},
        )
        return await _embed_query(text_)


async def _embed_query(text_: str) -> list[float]:
    if not settings.gemini_api_key:
        raise EmbeddingUnavailableError("GEMINI_API_KEY not configured")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            data = await _post(
                client,
                "embedContent",
                {
                    "content": {"parts": [{"text": text_}]},
                    "taskType": TASK_QUERY,
                    "outputDimensionality": EMBEDDING_DIMS,
                },
            )
        values = data["embedding"]["values"]
    except httpx.HTTPError as exc:
        raise EmbeddingUnavailableError(f"embedContent network error: {exc}") from exc
    except (KeyError, TypeError) as exc:
        raise EmbeddingUnavailableError("embedContent returned an unexpected shape") from exc
    return l2_normalize(values)


async def embed_documents(
    texts: list[str],
    *,
    task_type: str = TASK_DOCUMENT,
    rate_limit_retries: int = 0,
) -> list[list[float]]:
    with tracing.current_trace().span(
        "embed_documents", input={"texts": len(texts), "chars": sum(len(t) for t in texts)}
    ) as span:
        span.set(
            model=settings.gemini_embedding_model,
            provider="gemini",
            metadata={
                "dims": EMBEDDING_DIMS,
                "task_type": task_type,
                "batches": -(-len(texts) // _BATCH_SIZE),
            },
        )
        return await _embed_documents(texts, task_type=task_type, rate_limit_retries=rate_limit_retries)


async def _embed_documents(
    texts: list[str],
    *,
    task_type: str,
    rate_limit_retries: int,
) -> list[list[float]]:
    """Batched, so a full re-index costs ~3 requests instead of ~150.

    `task_type` defaults to RETRIEVAL_DOCUMENT (what the portfolio chunks use).
    The chat guard's example messages pass TASK_QUERY instead, so they live in
    the same embedding space as the visitor messages they are compared to.

    `rate_limit_retries` > 0 waits out a 429 (per-minute free-tier limit) and
    retries the batch. Only the offline scripts use it: the app leaves it at 0,
    because reindexing after an admin write runs under a 60 s function limit and
    must fail fast instead of sleeping."""
    if not settings.gemini_api_key:
        raise EmbeddingUnavailableError("GEMINI_API_KEY not configured")

    out: list[list[float]] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0)) as client:
        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            payload = {
                "requests": [
                    {
                        "model": f"models/{settings.gemini_embedding_model}",
                        "content": {"parts": [{"text": t}]},
                        "taskType": task_type,
                        "outputDimensionality": EMBEDDING_DIMS,
                    }
                    for t in batch
                ]
            }
            retries_left = rate_limit_retries
            while True:
                try:
                    data = await _post(client, "batchEmbedContents", payload)
                    batch_vectors = [e["values"] for e in data["embeddings"]]
                    break
                except EmbeddingRateLimitedError:
                    if retries_left <= 0:
                        raise
                    retries_left -= 1
                    await asyncio.sleep(_RATE_LIMIT_WAIT_SECONDS)
                except httpx.HTTPError as exc:
                    raise EmbeddingUnavailableError(f"batchEmbedContents network error: {exc}") from exc
                except (KeyError, TypeError) as exc:
                    raise EmbeddingUnavailableError(
                        "batchEmbedContents returned an unexpected shape"
                    ) from exc
            if len(batch_vectors) != len(batch):
                raise EmbeddingUnavailableError(
                    f"batchEmbedContents returned {len(batch_vectors)} vectors for {len(batch)} inputs"
                )
            out.extend(l2_normalize(v) for v in batch_vectors)
            if start + _BATCH_SIZE < len(texts):
                await asyncio.sleep(1.0)  # stay under the free tier's 100 RPM
    return out
