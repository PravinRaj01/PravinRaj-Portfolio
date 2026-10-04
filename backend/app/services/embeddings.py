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

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"
TASK_QUERY = "RETRIEVAL_QUERY"
EMBEDDING_DIMS = 768
_BATCH_SIZE = 50


class RagUnavailableError(RuntimeError):
    """Retrieval can't run for this request -- the caller must fall back to
    the full portfolio context."""


class EmbeddingUnavailableError(RagUnavailableError):
    """No embedding could be produced (missing key, quota, network, 4xx/5xx)."""


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
        raise EmbeddingUnavailableError(
            f"{path} failed: HTTP {response.status_code} {response.text[:300]}"
        )
    return response.json()


async def embed_query(text_: str) -> list[float]:
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


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Batched, so a full re-index costs ~3 requests instead of ~150."""
    if not settings.gemini_api_key:
        raise EmbeddingUnavailableError("GEMINI_API_KEY not configured")

    out: list[list[float]] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0)) as client:
        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            try:
                data = await _post(
                    client,
                    "batchEmbedContents",
                    {
                        "requests": [
                            {
                                "model": f"models/{settings.gemini_embedding_model}",
                                "content": {"parts": [{"text": t}]},
                                "taskType": TASK_DOCUMENT,
                                "outputDimensionality": EMBEDDING_DIMS,
                            }
                            for t in batch
                        ]
                    },
                )
                batch_vectors = [e["values"] for e in data["embeddings"]]
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
