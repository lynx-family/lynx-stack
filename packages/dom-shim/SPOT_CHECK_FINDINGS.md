# Phase 1 Spot Check — Findings (n=10, gpt-4o)

> **Source data:** `SPOT_CHECK_HARD_N10.{md,json}` and the run before it. Both committed.

## Headline numbers

Hard subset (7 moderate + 3 complex prompts across all 7 categories):

| Route         | parse_ok | render_ok (one-shot) | convergence (N=3) |
| ------------- | -------- | -------------------- | ----------------- |
| A (raw PAPI)  | 1.000    | 1.000                | 1.000             |
| B (DOM Shim)  | 1.000    | 1.000                | 1.000             |
| C (A2UI JSON) | 0.800    | 0.800                | 1.000             |

Trivial subset (8 trivial + 2 simple prompts), reported for completeness:

| Route | parse_ok | render_ok (one-shot) | convergence (N=3) |
| ----- | -------- | -------------------- | ----------------- |
| A     | 1.000    | 1.000                | 1.000             |
| B     | 1.000    | 1.000                | 1.000             |
| C     | 1.000    | 1.000                | 1.000             |

## Surprises

**1. The RFC's headline hypothesis is _partially false_ on this data.**

The RFC argues: "LLM training corpora are heavy in HTML/CSS/JS, so generation correctness is high." The implicit prediction is that raw `__CreateView()` PAPI (which LLMs _don't_ see in training) will perform worse than DOM-style JS (which they do). On gpt-4o with the 476-line `.d.ts` embedded in the system prompt, that prediction does **not** hold: Route A matches Route B exactly at 100/100 render_ok on moderate+complex prompts. The training-corpus angle does not produce a visible delta here.

**2. Schema-constrained JSON has the _worst_ one-shot rate.**

Route C (A2UI JSON DSL) is the only route below 100% one-shot. Its 2/10 failures were both schema-violation issues: one used a `tag` value not in the enum, one had `additionalProperties` outside the allowed set. The model is fine at JSON syntax (parse_ok=80% counts schema failure as parse failure) — it just struggles to obey schema constraints on first try. **All 2 failures self-corrected by round 2 or 3.** Convergence is still 1.000.

**3. Self-repair is highly effective at this complexity.**

Across all three routes, N=3 convergence is 1.000. Whatever the route gets wrong on round 1, it fixes by round 3 when fed back the error log. This argues for measuring convergence rate as the primary metric, not one-shot render rate.

**4. The "Route A sandbox" bug masked everything previously.**

The original `vm.runInNewContext` ran the LLM's TypeScript output as raw JS. gpt-4o correctly emits typed signatures (`function render(x: PageElementRef): void`), so every Route A run failed with "Unexpected token ':'" or "exports is not defined". n=2 smoke and the first n=10 both reported Route A = 0% — that was the benchmark measuring its own bug, not the LLM. Once `ts.transpileModule` strips types before `vm.runInNewContext`, Route A jumps from 0% to 100%.

This is a methodology lesson worth keeping for Phase 2: **benchmark bugs masquerade as LLM failures**. Any time a route shows 0% in a uniform pattern, suspect the harness first.

**5. The earlier n=2 "Route C wins" reading was overfit.**

The first live smoke (n=2 on P001, P002) showed C=2/2 and A=0/2, concluding "C is the leader." Both halves were wrong: C is actually the _weakest_ route at one-shot once we sample harder prompts, and A was masking a benchmark bug. **n=2 cannot tell us anything about route comparison.**

## What this means for the RFC and the proposed Shim

This is genuinely complicated. On the strict question "which output format gets the highest LLM accuracy", the data so far says:

- Raw PAPI = DOM Shim > A2UI JSON (at one-shot, hard prompts)
- All three = 1.000 (with N=3 self-repair, hard prompts)

If the RFC's only goal is "LLM-friendly output", this data is **consistent with the existing RFC** (raw `__XXX` PAPI is fine when given the d.ts in system prompt). The proposed DOM Shim doesn't have a clear correctness advantage to justify itself on this metric alone.

The Shim's _other_ justifications remain intact and untouched by this data:

- **Web library interop** (the React Native motivation) — Route A can't import `react-virtual`, `focus-trap`, etc. Route B can.
- **Bundle size of the LLM system prompt** — Route A embeds 476 lines of `.d.ts` in every prompt. Route B is much shorter. At per-token economics this is the most concrete delta the data could surface — and we can compute it from the `tokens_used` field already in the records.
- **Web developer onboarding mental model** — outside Phase 1's measurement scope.
- **Hand-coded path for non-LLM consumers** — outside Phase 1's measurement scope.

## Methodology caveats

1. **n=10 is still small.** Don't draw final conclusions before the n=50 sweep.
2. **Single model.** gpt-4o is one data point. Claude Opus 4.7, Sonnet, and possibly older models could shift the picture. The DOM Shim's "training-data" advantage might be more visible on weaker / less-prompt-following models.
3. **render_ok is a low bar.** It only checks "did at least one Create + Append + Flush call happen, no exceptions." Producing _the right_ UI (correctly counting buttons, correctly handling click events, correctly rendering nested structure) requires M4 visual scoring, which is not measured yet (puppeteer rasterization is still a follow-up).
4. **Token cost is not yet aggregated into the report**, but it's in each per-record `tokens_used` field. Worth adding to the summary table.
5. **The mock PAPI may be too forgiving.** It accepts almost any tag name via `__CreateElement(tag)` fallback. A real Lynx engine would reject unknown tags. The benchmark is measuring "code that runs in a permissive mock" not "code that runs on actual Lynx."

## Recommended next moves

1. **Add token cost to the summary table** in `harness.ts`. The per-prompt cost delta between routes is likely the most consequential RFC input we can extract from the existing data.
2. **Run the full 50-prompt sweep**, both models (gpt-4o + claude-opus-4-7), N=3 rounds. Estimated cost ≈ $20-40. This produces the n=50 number set that should drive the actual RFC decision.
3. **Wire puppeteer for M4** before the full sweep, so visual fidelity (not just render_ok) is in the data.
4. **Consider tightening the mock PAPI's `__CreateElement` to reject unknown tags** so the "tag enum" Route C check has a real-Lynx-equivalent in Routes A and B.
