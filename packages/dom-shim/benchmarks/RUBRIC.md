# Phase 1 Benchmark Rubric

This document defines the four metrics by which the three LLM-output routes (A: raw Element PAPI, B: DOM Shim, C: A2UI JSON) are compared. All routes are scored against the same yardstick using the same mock PAPI runtime, same screenshot pipeline, and same visual scorer.

The rubric is **load-bearing**: changing a metric definition mid-run invalidates the comparison. Treat this document as part of the benchmark's API surface.

---

## Metric M1 — One-shot parse rate

> **Definition:** The fraction of prompts on which the LLM-emitted artifact parses (or, in the JSON-DSL case, validates) successfully on the very first generation, before any self-repair round.

**Per-prompt value:** `0` or `1`.

**Aggregate:** `mean(per_prompt_parse_ok over all 50 prompts)`, reported as percentage.

**Per route, "parse" means:**

| Route         | Parse success means                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A (raw PAPI)  | The generated TypeScript snippet passes through `ts.createSourceFile()` with `diagnostics.length === 0`.                                       |
| B (DOM Shim)  | The generated HTML+script snippet parses without throwing, both the HTML side via `htmlparser2` and the `<script>` side via `new vm.Script()`. |
| C (A2UI JSON) | The generated JSON parses via `JSON.parse()` AND validates against the A2UI schema in `routes/route-c-schema.json` via ajv.                    |

**Why this metric matters:** It is the lowest possible bar — "the model produced something well-formed." A route that fails here is unusable regardless of semantic quality.

---

## Metric M2 — One-shot render rate

> **Definition:** The fraction of prompts on which the artifact, on first generation, both parses (M1) AND drives the mock runtime to produce a non-trivial element tree, before any self-repair round.

**Per-prompt value:** `0` or `1`.

**Aggregate:** `mean(per_prompt_render_ok over all 50 prompts)`, reported as percentage.

**Requires:** `parse_ok == 1` (failing parse forces render_ok to 0).

**"Renders successfully" means:**

| Route         | Render success means                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (raw PAPI)  | Mock runtime observed at least one `__CreateXxx` call, at least one `__AppendElement` call, and at least one `__FlushElementTree` call. No uncaught exception during execution. |
| B (DOM Shim)  | Same as A: the Shim's PAPI proxy observed `__CreateXxx + __AppendElement + __FlushElementTree`. No uncaught exception during execution.                                         |
| C (A2UI JSON) | The schema-validated JSON walker successfully traversed the tree and emitted `__CreateXxx + __AppendElement + __FlushElementTree` to the mock runtime. No walker error.         |

**Why this metric matters:** This is the proxy for "did the model produce something an engine would actually render?". M2 is the primary axis along which the three routes are compared.

---

## Metric M3 — N-round convergence rate (N = 3)

> **Definition:** The fraction of prompts on which the artifact reaches `render_ok == 1` within at most 3 LLM rounds, where each round after the first is given the previous round's error log as additional input.

**Per-prompt value:** `0` or `1`.

**Aggregate:** `mean(per_prompt_convergence_ok over all 50 prompts)`, reported as percentage.

**Round definition:**

1. Round 1 = the first generation. If `render_ok == 1` here, convergence = 1.
2. Round 2 = a new generation conditioned on:
   - the original prompt
   - the round-1 artifact verbatim
   - the round-1 `error_log` field (concatenated parse/runtime errors)
3. Round 3 = same shape, conditioned on round 2.

A prompt converges when **any** round k ∈ {1, 2, 3} produces `render_ok == 1`. Once converged, no further rounds are attempted for that prompt.

**Error log feed-back rules:**

| Route | What goes into `error_log` for the next round                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| A     | TypeScript diagnostic messages; any caught runtime exception with stack trace; PAPI-missing warnings from mock runtime.   |
| B     | HTML parser errors with `(line, col)`; `vm.Script` compile errors; runtime exceptions thrown by the Shim or by user code. |
| C     | `JSON.parse` errors with `(line, col)`; ajv schema-validation error array; walker exceptions.                             |

**Why N = 3:** Per PRD OQ-10, N = 3 is the Phase 1 budget choice. Higher N is closer to realistic agent loops but costs more LLM tokens; raising it is a Phase 2 decision.

---

## Metric M4 — Visual similarity to intent

> **Definition:** A vision LLM scores each successfully-rendered artifact on how well its rendered preview matches the prompt's verbal description.

**Per-prompt value:** A floating-point number in `[0, 1]`, OR `null` if the artifact never rendered (i.e. M3 = 0 for that prompt).

**Aggregate:** `mean(per_prompt_visual_score over prompts where score is not null)`, reported as decimal.

**Scoring procedure:**

1. After the final round (whether converged or not), the mock runtime's recorded tree is rendered to a static HTML preview using the trivial mapping `view → <div>`, `text → <span>`, `image → <img>`, `scroll-view → <div style="overflow: auto">`. Other Lynx tags get a corresponding tag if obvious or `<div>` fallback.
2. The static HTML is screenshotted at 800×1200 viewport via Puppeteer.
3. The screenshot + the original prompt text are sent to the vision LLM (Claude Opus 4.7 by default per PRD OQ-8) with this instruction (verbatim, do not paraphrase in implementation):

   > Rate from 0 to 5 how well this screenshot matches the prompt description.
   > Consider:
   >
   > - presence of the described UI elements
   > - basic layout correctness
   > - visual quality and polish
   >   Return JSON: `{"score": <0..5 integer>, "rationale": "<one short sentence>"}`.

4. The integer raw score `s ∈ {0,1,2,3,4,5}` is normalized: `normalized = s / 5.0`.

**Per-prompt cache:** Results are cached at `benchmarks/cache/visual-scores.json` keyed by `${sha256(screenshot)}::${prompt_id}`. Cached entries are reused if the cache key matches.

**If `ANTHROPIC_API_KEY` is unset:**
The scoring path returns `{score: null, rationale: "no API key — visual scoring skipped"}` and the report notes that M4 was not measured. M1/M2/M3 are still meaningful without M4.

**Why this metric matters:** M2 and M3 measure "did something render" but not "did the right thing render." M4 is the only metric that catches "model produced a working calendar when asked for a counter."

---

## Aggregate report shape

The benchmark harness emits two final artifacts: `report.json` (machine-readable, schema in `schema/result.schema.json`) and `report.md` (human-readable narrative).

`report.json` top-level shape (see also `schema/result.schema.json`):

```jsonc
{
  "schema_version": "1.0.0",
  "run_id": "smoke-20260613-2000",
  "started_at": "2026-06-13T20:00:00Z",
  "finished_at": "2026-06-13T20:05:32Z",
  "model_id": "claude-opus-4-7",
  "rounds": 3,
  "concurrency": 4,
  "summary": {
    "A": { "parse_ok_rate": 0.94, "render_ok_rate": 0.42, "convergence_rate": 0.58, "visual_score_mean": 0.32 },
    "B": { "parse_ok_rate": 0.98, "render_ok_rate": 0.78, "convergence_rate": 0.86, "visual_score_mean": 0.61 },
    "C": { "parse_ok_rate": 1.00, "render_ok_rate": 0.66, "convergence_rate": 0.72, "visual_score_mean": 0.48 }
  },
  "per_category": {
    "interactive": { "A": {...}, "B": {...}, "C": {...} },
    "form": { ... },
    "layout": { ... },
    "list": { ... },
    "media": { ... },
    "navigation": { ... },
    "data-display": { ... }
  },
  "records": [
    {
      "prompt_id": "P001",
      "route": "A",
      "round": 1,
      "generated_code": "...",
      "parse_ok": true,
      "render_ok": false,
      "screenshot_path": "screenshots/P001-A-r1.png",
      "error_log": "TypeError: __CreatPage is not a function",
      "visual_score": null,
      "timestamp": "2026-06-13T20:00:12Z",
      "model_id": "claude-opus-4-7",
      "tokens_used": { "input": 4123, "output": 312 }
    }
  ]
}
```

Each record is a single (prompt, route, round) tuple. A prompt that converges in round 2 produces 2 records for that route; one that exhausts all 3 rounds produces 3.

`report.md` includes:

- Summary table — 3 routes × 4 metrics
- Per-category breakdown — routes × metrics × category
- Per-prompt detail — 50 prompts × per-route results
- Failure analysis — top 5 most common error patterns per route
- Visual examples — for 5 representative prompts, side-by-side screenshots from each route
- Recommendation block — auto-filled when one route's M2 (render_ok_rate) exceeds the others' by ≥ 20 percentage points
