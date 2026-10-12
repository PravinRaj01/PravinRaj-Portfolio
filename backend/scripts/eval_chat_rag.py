"""Evaluates the chatbot's retrieval and answers, and logs the run to Opik.

    PYTHONPATH=. python scripts/eval_chat_rag.py                 # professional mode
    PYTHONPATH=. python scripts/eval_chat_rag.py --mode creative
    PYTHONPATH=. python scripts/eval_chat_rag.py --limit 5 --no-judge   # a quick, cheap look

For every question (built from the live content, see chat_eval_set.py) it runs
the same steps as a visitor's message does -- embed, hybrid search, build the
prompt, ask the model -- and scores:

  hit@1, hit@k, MRR   did retrieval surface the entry the question is about?
  answer relevance    an LLM judge: does the answer address the question?
  groundedness        an LLM judge: is every claim in the answer supported by
                      the context the chatbot was given? (1 = fully; this is
                      the inverse of a "hallucination" score)

Each question becomes a trace tagged "eval" (so it never counts as visitor
traffic) with the retrieval and model-call spans attached, and the run is
recorded in Opik as a dataset + experiment, which the admin Evaluations tab
reads. Without an Opik key it prints the results and writes nothing to Opik.

Costs, on the free tiers: ~2 embedding requests, 1 answer and 2 judge calls per
question, paced by --pause so the per-minute limits aren't hit.

The database is whatever DATABASE_URL points at -- it only reads (and, with
--reindex, rebuilds the search index).
"""
import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import ai_content, ai_gateway, embeddings, evals, opik_api, opik_eval, rag_index, tracing
from app.services.evals import Expected, RagItemResult, retrieval_outcome
from scripts.chat_eval_set import EvalQuestion, build_questions

FORCED_JUDGE = {"type": "function", "function": {"name": evals.JUDGE_TOOL_NAME}}
RETRIES = 3  # the free tiers' per-minute limits are the usual reason a call fails


async def call_model(messages: list[dict[str, str]], **kwargs) -> dict:
    """chat_completion with backoff on the transient failures a free tier
    produces (429 rate limited, 502 upstream hiccup)."""
    for attempt in range(RETRIES + 1):
        try:
            return await ai_gateway.chat_completion(messages, **kwargs)
        except HTTPException as exc:
            if exc.status_code not in (429, 502) or attempt == RETRIES:
                raise
            wait = 15 * (attempt + 1)
            print(f"      model busy (HTTP {exc.status_code}); retrying in {wait}s", file=sys.stderr)
            await asyncio.sleep(wait)
    raise AssertionError("unreachable")


async def judge(messages: list[dict[str, str]]) -> evals.Judgement | None:
    try:
        completion = await call_model(
            messages,
            model_kind="content",
            tools=[evals.JUDGE_TOOL],
            tool_choice=FORCED_JUDGE,
            max_tokens=400,
        )
    except HTTPException as exc:  # a failed judge is "not judged", never a made-up score
        print(f"      judge failed: HTTP {exc.status_code} {exc.detail}", file=sys.stderr)
        return None
    except Exception as exc:
        print(f"      judge failed: {type(exc).__name__}: {str(exc)[:120]}", file=sys.stderr)
        return None
    judgement = evals.parse_judgement(completion)
    if judgement is None:
        print("      judge returned no usable score", file=sys.stderr)
    return judgement


async def evaluate_one(
    db, q: EvalQuestion, mode: str, *, with_judge: bool, run_tag: str
) -> tuple[RagItemResult, str | None]:
    started = time.perf_counter()
    k = settings.rag_top_k
    trace = tracing.start_trace(
        "eval.rag",
        input={"question": q.question, "expected": [e.to_dict() for e in q.expected]},
        tags=["eval", "rag", run_tag],
        metadata={"topic": q.topic, "content_mode": mode},
    )
    result = RagItemResult(question=q.question, expected=q.expected, outcome=retrieval_outcome(q.expected, [], k=k))
    try:
        vector = await embeddings.embed_query(q.question)
        rows = await ai_content._retrieve(db, q.question, mode, vector)  # same hybrid search the chatbot runs
        retrieved = [(r.title, r.source_type) for r in rows]
        result.retrieved_titles = [t or "" for t, _ in retrieved]
        result.outcome = retrieval_outcome(q.expected, retrieved, k=k)

        # The prompt is composed exactly as ai_content._open_chat_stream does on its RAG path.
        core, hero, resume_url = await ai_content._build_core_context(db, mode)
        context = core + ai_content._format_hits(rows)
        system = ai_content._chat_system_prompt(
            hero.name if hero else "this portfolio", context, resume_url, retrieved=True
        )
        completion = await call_model(
            [{"role": "system", "content": system}, {"role": "user", "content": q.question}], model_kind="chat"
        )
        choices = completion.get("choices") or []
        result.answer = ((choices[0].get("message") or {}).get("content") or "").strip() if choices else ""

        if with_judge and result.answer:
            result.relevance = await judge(evals.relevance_messages(q.question, result.answer))
            result.groundedness = await judge(evals.groundedness_messages(q.question, result.answer, context))
    except Exception as exc:
        result.error = f"{type(exc).__name__}: {str(exc)[:160]}"
        trace.fail(exc)
    finally:
        result.latency_ms = (time.perf_counter() - started) * 1000
        trace.set_output(
            {
                "answer": result.answer,
                "retrieved": result.retrieved_titles,
                "rank": result.outcome.rank,
                "relevance": result.relevance.score if result.relevance else None,
                "groundedness": result.groundedness.score if result.groundedness else None,
            }
        )
        await trace.finish()
    return result, trace.id or None


def item_scores(r: RagItemResult) -> tuple[dict[str, float], dict[str, str]]:
    scores = {
        "hit_at_1": float(r.outcome.hit_at_1),
        "hit_at_k": float(r.outcome.hit_at_k),
        "reciprocal_rank": r.outcome.reciprocal_rank,
    }
    reasons: dict[str, str] = {}
    if r.relevance:
        scores["answer_relevance"], reasons["answer_relevance"] = r.relevance.score, r.relevance.reason
    if r.groundedness:
        scores["groundedness"], reasons["groundedness"] = r.groundedness.score, r.groundedness.reason
    return scores, reasons


def pct(value: float | None) -> str:
    return "  -  " if value is None else f"{value:5.0%}"


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--mode", choices=["professional", "creative"], default="professional")
    parser.add_argument("--limit", type=int, default=0, help="only the first N questions")
    parser.add_argument("--no-judge", action="store_true", help="retrieval metrics only (no LLM calls)")
    parser.add_argument("--pause", type=float, default=3.0, help="seconds between questions (free-tier rate limits)")
    parser.add_argument("--name", help="experiment name (default: rag-<mode>-<timestamp>)")
    parser.add_argument("--notes", help="free text stored with the run, e.g. what changed")
    parser.add_argument("--reindex", action="store_true", help="rebuild the search index first")
    parser.add_argument("--no-log", action="store_true", help="don't write to Opik even if a key is set")
    parser.add_argument("--json", help="also write the full results to this file")
    args = parser.parse_args()

    log_to_opik = opik_api.is_configured() and not args.no_log
    if log_to_opik:
        settings.opik_enabled = True  # eval traces are only delivered when tracing is on
    else:
        settings.opik_enabled = False
        print("(Opik is not configured or --no-log: results are printed only)\n")

    async with SessionLocal() as db:
        if args.reindex:
            print("re-indexing...", await rag_index.reindex(db, force=False))
        try:
            questions = await build_questions(db, args.mode)
        except Exception as exc:
            print(f"could not build questions: {exc}", file=sys.stderr)
            return 1
        if args.limit:
            questions = questions[: args.limit]
        if not questions:
            print("no questions: is the search index empty? (run with --reindex)", file=sys.stderr)
            return 1

        run_name = args.name or f"rag-{args.mode}-{datetime.now(timezone.utc):%Y%m%d-%H%M}"
        print(f"{run_name}: {len(questions)} questions, mode={args.mode}, k={settings.rag_top_k}, "
              f"judge={'off' if args.no_judge else 'on'}\n")

        results: list[tuple[EvalQuestion, RagItemResult, str | None]] = []
        for i, q in enumerate(questions, start=1):
            r, trace_id = await evaluate_one(db, q, args.mode, with_judge=not args.no_judge, run_tag=run_name)
            results.append((q, r, trace_id))
            status = "ERROR " + (r.error or "") if r.error else (
                f"rank {r.outcome.rank}" if r.outcome.rank else "MISS"
            )
            print(f"{i:>2}. [{status:<8}] rel={pct(r.relevance.score if r.relevance else None)} "
                  f"grd={pct(r.groundedness.score if r.groundedness else None)}  {q.question}")
            if i < len(questions):
                await asyncio.sleep(args.pause)

    summary = evals.summarize_rag([r for _, r, _ in results], k=settings.rag_top_k)
    print("\n=== SUMMARY ===")
    print(f"questions {summary['items']}  (errors {summary['errors']}, judged {summary['judged']})")
    print(f"hit@1 {pct(summary['hit_at_1'])}   hit@{summary['k']} {pct(summary['hit_at_k'])}   MRR {summary['mrr']}")
    print(f"answer relevance {pct(summary['answer_relevance'])}   groundedness {pct(summary['groundedness'])}   "
          f"avg latency {summary['latency_ms_avg'] or 0:.0f} ms")
    for question in summary["misses"]:
        print(f"   not retrieved: {question!r}")

    run_settings = {
        "mode": args.mode,
        "rag_top_k": settings.rag_top_k,
        "rag_pool": settings.rag_pool,
        "rag_min_score": settings.rag_min_score,
        "chat_model": settings.gemini_chat_model,
        "content_model": settings.gemini_content_model,
        "embedding_model": settings.gemini_embedding_model,
    }

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "name": run_name,
                    "summary": summary,
                    "settings": run_settings,
                    "items": [
                        {
                            "question": q.question,
                            "expected": [e.to_dict() for e in q.expected],
                            "retrieved": r.retrieved_titles,
                            "rank": r.outcome.rank,
                            "answer": r.answer,
                            "scores": item_scores(r)[0],
                            "error": r.error,
                        }
                        for q, r, _ in results
                    ],
                },
                fh,
                indent=2,
            )
        print(f"\nwrote {args.json}")

    if log_to_opik:
        items = []
        for q, r, trace_id in results:
            scores, reasons = item_scores(r)
            items.append(opik_eval.EvalLogItem(data=q.to_data(), trace_id=trace_id, scores=scores, reasons=reasons))
        try:
            experiment_id = await opik_eval.log_experiment(
                name=run_name,
                dataset_name=f"portfolio-rag-{args.mode}",
                dataset_description="Questions generated from the live portfolio content (scripts/chat_eval_set.py)",
                items=items,
                metadata={"kind": "rag", "summary": summary, "settings": run_settings, "notes": args.notes or ""},
            )
            print(f"\nlogged to Opik: experiment {experiment_id}")
        except Exception as exc:
            print(f"\ncould not log to Opik ({type(exc).__name__}: {exc}); results above are still valid", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
