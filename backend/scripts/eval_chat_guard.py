"""Evaluates the chat guard on held-out messages and picks its thresholds.

    PYTHONPATH=. python scripts/eval_chat_guard.py

1. Embeds the DEV and TEST messages from chat_guard_eval_set.py (~100 texts,
   ~2 embedding requests).
2. Tunes the two thresholds (min similarity, margin) per blocking rule on DEV
   only, under one hard constraint: no legitimate message may be blocked, with
   a safety buffer so the choice isn't balanced on a knife edge.
3. Scores TEST -- never used for tuning -- with those thresholds and prints
   the ship-gate verdict.

Legitimate messages blocked is the number that matters most: a missed jailbreak
just falls through to the LLM (as it does today), but a wrongly blocked
visitor is a real cost.
"""
import asyncio
import sys

from app.services import chat_guard, embeddings
from app.services.chat_guard import Thresholds
from app.services.chat_guard_examples import (
    EXAMPLES,
    LABEL_INJECTION,
    LABEL_OFF_TOPIC,
    LABEL_PORTFOLIO,
)
from scripts.chat_guard_eval_set import DEV, TEST

# Smallest distance a legitimate message must stay from the block region.
MIN_SLACK = 0.02
SHIP_MIN_INJECTION_CATCH = 0.70


def _assert_held_out() -> None:
    seen = {text.strip().lower() for _, text in EXAMPLES}
    overlap = [
        t
        for half in (DEV, TEST)
        for texts in half.values()
        for t in texts
        if t.strip().lower() in seen
    ]
    if overlap:
        sys.exit(f"eval messages overlap the guard's examples: {overlap}")


def _grid(lo: float, hi: float, step: float):
    n = round((hi - lo) / step)
    return [round(lo + i * step, 4) for i in range(n + 1)]


def _slack(point: tuple[float, float], th: Thresholds) -> float:
    """How far a message is from being blocked (negative = blocked)."""
    sim, margin = point
    return max(th.min_sim - sim, th.margin - margin)


def tune(label: str, legit: list[dict], target: list[dict]) -> tuple[Thresholds | None, str]:
    def pt(best):  # (similarity to `label`, margin over the nearest portfolio example)
        return best[label], best[label] - best[LABEL_PORTFOLIO]

    legit_pts = [pt(b) for b in legit]
    target_pts = [pt(b) for b in target]
    best_cfg = None
    for sim in _grid(0.55, 0.98, 0.005):
        for margin in _grid(0.0, 0.25, 0.005):
            th = Thresholds(sim, margin)
            slack = min(_slack(p, th) for p in legit_pts)
            if slack < MIN_SLACK:
                continue
            caught = sum(1 for p in target_pts if _slack(p, th) <= 0)
            key = (caught, slack)
            if best_cfg is None or key > best_cfg[0]:
                best_cfg = (key, th)
    if best_cfg is None:
        return None, "no threshold keeps every legitimate message clear of the block region"
    (caught, slack), th = best_cfg
    return th, f"min_sim={th.min_sim:.3f} margin={th.margin:.3f}  (dev: caught {caught}/{len(target)}, legit slack {slack:.3f})"


def _fmt(best: dict[str, float]) -> str:
    return " ".join(f"{k[:4]}={best.get(k, 0):.3f}" for k in (LABEL_PORTFOLIO, LABEL_OFF_TOPIC, LABEL_INJECTION))


async def embed_all(index) -> dict[str, dict[str, list[dict]]]:
    out: dict[str, dict[str, list[dict]]] = {}
    texts, slots = [], []
    for half_name, half in (("dev", DEV), ("test", TEST)):
        out[half_name] = {}
        for kind, msgs in half.items():
            out[half_name][kind] = []
            for m in msgs:
                texts.append(m)
                slots.append((half_name, kind, m))
    vectors = await embeddings.embed_documents(
        texts, task_type=embeddings.TASK_QUERY, rate_limit_retries=4
    )
    for (half_name, kind, msg), vec in zip(slots, vectors, strict=True):
        best = chat_guard.similarity_by_label(vec, index)
        out[half_name][kind].append({"msg": msg, **best})
    return out


async def main() -> None:
    _assert_held_out()
    index = chat_guard._load_index()
    if index is None:
        sys.exit("chat_guard_index.json is missing or stale; run scripts/build_chat_guard_index.py")

    data = await embed_all(index)

    def rows(half, kind):
        return data[half][kind]

    print("=== TUNING (DEV only) ===")
    inj_th, inj_note = tune(LABEL_INJECTION, rows("dev", "legit"), rows("dev", "injection"))
    off_th, off_note = tune(LABEL_OFF_TOPIC, rows("dev", "legit"), rows("dev", "off_topic"))
    print("injection rule :", inj_note)
    print("off-topic rule :", off_note)
    if inj_th is None:
        sys.exit("cannot pick injection thresholds; guard stays off")

    print("\n=== TEST (never tuned on) ===")
    def apply(rule_off: Thresholds | None, msgs):
        return [chat_guard.decide({k: v for k, v in m.items() if k != "msg"}, inj_th, rule_off) for m in msgs]

    for with_off, title in ((False, "injection rule only"), (True, "injection + off-topic rules")):
        if with_off and off_th is None:
            continue
        rule = off_th if with_off else None
        legit = apply(rule, rows("test", "legit"))
        inj = apply(rule, rows("test", "injection"))
        off = apply(rule, rows("test", "off_topic"))
        n_l, n_i, n_o = len(legit), len(inj), len(off)
        fp = [m["msg"] for m, d in zip(rows("test", "legit"), legit) if d.block]
        miss = [m["msg"] for m, d in zip(rows("test", "injection"), inj) if not d.block]
        print(f"\n-- {title} --")
        print(f"legitimate blocked : {len(fp)}/{n_l}   {fp if fp else ''}")
        print(f"injections caught  : {n_i - len(miss)}/{n_i}  ({(n_i - len(miss)) / n_i:.0%})")
        print(f"off-topic caught   : {sum(d.block for d in off)}/{n_o}")
        for msg in miss:
            print(f"   missed injection: {msg!r}")

    print("\n=== closest legitimate messages to the injection rule (TEST) ===")
    near = sorted(rows("test", "legit"), key=lambda m: -m[LABEL_INJECTION])[:5]
    for m in near:
        print(f"   {_fmt(m)}  {m['msg']!r}")

    legit = apply(None, rows("test", "legit"))
    inj = apply(None, rows("test", "injection"))
    fp_n = sum(d.block for d in legit)
    caught = sum(d.block for d in inj) / len(inj)
    ok = fp_n == 0 and caught >= SHIP_MIN_INJECTION_CATCH
    print("\n=== SHIP GATE (injection rule) ===")
    print(f"legit blocked {fp_n}/{len(legit)} (need 0) | injections caught {caught:.0%} (need >= {SHIP_MIN_INJECTION_CATCH:.0%})")
    print("VERDICT:", "PASS" if ok else "FAIL -> leave CHAT_GUARD_ENABLED off")
    print(f"\nsuggested env: CHAT_GUARD_INJECTION_MIN_SIM={inj_th.min_sim} CHAT_GUARD_INJECTION_MARGIN={inj_th.margin}")
    if off_th:
        print(f"               CHAT_GUARD_OFFTOPIC_MIN_SIM={off_th.min_sim} CHAT_GUARD_OFFTOPIC_MARGIN={off_th.margin}")


asyncio.run(main())
