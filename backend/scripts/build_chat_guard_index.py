"""Regenerates app/services/chat_guard_index.json from chat_guard_examples.py.

Run from backend/ after ANY edit to the examples (or a change of embedding
model); the guard refuses to use an index whose hash doesn't match:

    PYTHONPATH=. python scripts/build_chat_guard_index.py

Costs ~2 embedding requests against the free tier's 1,000/day.
"""
import asyncio
import json

from app.core.config import settings
from app.services import chat_guard, embeddings
from app.services.chat_guard_examples import EXAMPLES


async def main() -> None:
    # RETRIEVAL_QUERY, not DOCUMENT: these are compared against visitor
    # messages, which are embedded as queries.
    vectors = await embeddings.embed_documents(
        [text for _, text in EXAMPLES], task_type=embeddings.TASK_QUERY, rate_limit_retries=4
    )
    data = {
        "model": settings.gemini_embedding_model,
        "task_type": embeddings.TASK_QUERY,
        "dims": embeddings.EMBEDDING_DIMS,
        "examples_hash": chat_guard.current_examples_hash(),
        "vectors": [
            {"label": label, "vec": chat_guard.encode_vector(vec)}
            for (label, _), vec in zip(EXAMPLES, vectors, strict=True)
        ],
    }
    chat_guard.INDEX_PATH.write_text(json.dumps(data), encoding="utf-8")
    counts: dict[str, int] = {}
    for label, _ in EXAMPLES:
        counts[label] = counts.get(label, 0) + 1
    size_kb = chat_guard.INDEX_PATH.stat().st_size / 1024
    print(f"wrote {chat_guard.INDEX_PATH.name}: {len(EXAMPLES)} examples {counts}, {size_kb:.0f} KB")


asyncio.run(main())
