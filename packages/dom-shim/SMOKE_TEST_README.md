# Phase 1 Smoke Test — Acceptance Gate

This file documents the US-109 acceptance gate run.

## Dry-run smoke (committed evidence)

`SMOKE_TEST_DRY_RUN.md` and `SMOKE_TEST_DRY_RUN.json` are the artifacts produced by:

```bash
pnpm -F @lynx-js/dom-shim benchmark \
    --dry-run \
    --routes A,B,C \
    --prompts P001,P002 \
    --rounds 1
```

The dry-run exits 0 with 6 records (2 prompts × 3 routes × 1 round) and emits `report.json` + `report.md` matching the result.schema.json shape. It exercises every component end-to-end: corpus loader, route registry, harness concurrency loop, mock PAPI runtime, mock DOM Shim, A2UI JSON walker, vm sandbox, preview HTML emitter, visual scorer (no-op without API key), aggregation, and Markdown report generation.

## Live smoke run — BLOCKED on `ANTHROPIC_API_KEY`

The harness is fully wired to call Claude (Anthropic SDK) for all three routes and for visual scoring. Running:

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm -F @lynx-js/dom-shim benchmark \
    --routes A,B,C \
    --prompts P001,P002 \
    --rounds 1
```

would produce the live-run report. Without the key the live run fails with the descriptive error:

```
Error: ANTHROPIC_API_KEY is not set. Real benchmark runs need a key;
use --dry-run to exercise the harness without calling the API.
```

To unblock and complete the gate:

1. Export an Anthropic API key into the shell that will run the benchmark.
2. Re-run the command above.
3. Commit the generated `packages/dom-shim/benchmarks/reports/<run>/report.md` to a non-ignored location (e.g. copy to `SMOKE_TEST_LIVE.md`).

**Do NOT** run the full 50-prompt sweep without explicit human approval — Phase 1's stop gate is exactly the 2-prompt smoke run above. The full sweep is the decision-data run and should be scheduled separately.
