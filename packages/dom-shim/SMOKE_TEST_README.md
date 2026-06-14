# Phase 1 Smoke Test — Acceptance Gate

This file documents the US-109 acceptance gate runs.

## Live smoke (gpt-4o, 2026-06-14)

`SMOKE_TEST_LIVE.md` and `SMOKE_TEST_LIVE.json` are the artifacts produced by a real LLM-driven run:

```bash
export OPENAI_API_KEY=sk-...
export NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem  # corporate cert bundle (see below)
pnpm -F @lynx-js/dom-shim benchmark --routes A,B,C --prompts P001,P002 --rounds 1 --model gpt-4o
```

Headline numbers (n=2, **not statistically meaningful** — gate-verification only):

| Route         | parse_ok | render_ok | convergence |
| ------------- | -------- | --------- | ----------- |
| A (raw PAPI)  | 1.000    | 0.000     | 0.000       |
| B (DOM Shim)  | 1.000    | 0.500     | 0.500       |
| C (A2UI JSON) | 1.000    | 1.000     | 1.000       |

### Caveats and known bugs uncovered by the live smoke

- **Route A render_ok = 0 is suspicious.** Failure pattern: `Unexpected token ':'`. Root cause is almost certainly a benchmark bug, not an LLM signal: the Route A sandbox runs the LLM's TypeScript output through `vm.runInNewContext`, which executes pure JS. gpt-4o correctly emitted typed function signatures like `function render(rootPageRef: PageElementRef): void` — JS chokes on the `:`. Fix would be a `ts.transpileModule` pass before `vm` exec, similar to what the `--experimental-strip-types` Node flag does. Filed for Phase 1.5 follow-up.
- **Route B render_ok = 0.5 includes one "forgot **flush**()" failure.** Prompt obedience issue — system prompt explicitly tells the model to end with `__flush__()` but it ignored it. Could be improved via a one-shot example in the prompt, or by making the harness call `__flush__()` post-hoc.
- **Visual scoring (M4) skipped.** `screenshot_path` currently points to HTML preview files, not rasterized PNG/JPEG. The visual scorer detects this and returns null. Wiring puppeteer to rasterize the preview before scoring is a Phase 1.5 follow-up.

### Corporate network note

ByteDance's TLS-inspecting proxy (`SealSuite SWG`) intercepts api.openai.com and presents a certificate signed by the corporate root, which is in the macOS Keychain but not Node's bundled CA list. To make Node trust the chain:

```bash
security find-certificate -c "SealSuite SWG Root CA - v1" -p /Library/Keychains/System.keychain > /tmp/sealsuite-root.pem
security find-certificate -c "SealSuite SWG Intermediate CA - v1" -p /Library/Keychains/System.keychain > /tmp/sealsuite-int.pem
cat /tmp/sealsuite-root.pem /tmp/sealsuite-int.pem /etc/ssl/cert.pem > /tmp/all-cas.pem
export NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem
```

## Dry-run smoke (committed earlier as the harness self-test)

`SMOKE_TEST_DRY_RUN.md` and `SMOKE_TEST_DRY_RUN.json` are the artifacts from:

```bash
pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A,B,C --prompts P001,P002 --rounds 1
```

The dry-run uses stub routes and is the harness's own self-test (file IO, concurrency loop, schema validation, report rendering). All metrics in the dry-run are 1.000 because stubs always return success. The dry-run is _not_ a benchmark data point.

## What's NEXT

Phase 1's purpose is to produce data justifying (or killing) the Shim path. The 2-prompt smoke above is gate verification — it confirms the pipeline can drive real LLMs and produce inspectable artifacts. It is **not** the decision-data run.

Before scheduling the full sweep:

1. Fix the Route A sandbox to actually run TypeScript output (transpile-then-exec).
2. Add a one-shot example to Route B's system prompt to nudge `__flush__()` discipline.
3. Optionally: wire puppeteer for M4 scoring.
4. Then run `--all --rounds 3` on the full 50-prompt corpus. Per PRD §3 US-109: **do not** run the full sweep without explicit human approval.
