# PRD: Phase 1.5 — Decision-Grade Benchmark Data

> **Status:** Draft for Ralph autonomous-agent execution
> **Branch:** `Huxpro/lynx-dom-shim-benchmark` (continue, do NOT branch)
> **Worktree:** `~/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark/`
> **Predecessor:** `PRD.md` (Phase 1) and `REPORT.md` (Phase 1 全程报告)
> **Stories:** US-151 .. US-155

## Read This First

Phase 1 is complete: harness built, 3 routes wired to real LLMs, n=10 spot check produced honest data (`SPOT_CHECK_HARD_N10.md`, `SPOT_CHECK_FINDINGS.md`, `REPORT.md`). That data was **insufficient to drive the RFC decision** for four specific reasons enumerated in REPORT.md §7. Phase 1.5 closes exactly those four gaps and produces the decision-grade dataset.

Phase 1.5 is **infrastructure refinement + one final big run**, not a re-architecture. No new packages, no new routes, no PRD-level open questions. Everything builds on Phase 1 code already on this branch.

---

## 1. Goals

Produce the dataset that resolves whether to build the proposed DOM Shim. Specifically:

- **G1:** Surface the token-cost delta between routes (this is in existing data but not aggregated).
- **G2:** Measure visual fidelity (M4) — render_ok=1.0 on hard prompts in Phase 1 is misleading because it only checks "some tree got built", not "the right tree".
- **G3:** Eliminate the "mock PAPI is too forgiving" caveat so A/B comparison vs C is fair.
- **G4:** Replace single-model gpt-4o data with a 2-model matrix (gpt-4o + claude-opus-4-7), validating any "Shim helps weaker models" effect.
- **G5:** Deliver a single committed decision document containing the final cross-product numbers, the recommendation, and the data caveats that survive.

If the n=50 × 3-route × 3-round × 2-model sweep produces a clear go/no-go signal, Phase 1.5 is the final deliverable before Phase 2 (tier spec) or before RFC closure (no Shim).

---

## 2. User Stories

### US-151: Aggregate token cost into the report

**Description:** Per-record `tokens_used: {input, output}` already exists from Phase 1. Surface a per-route input/output token sum + estimated USD cost in the summary table and the per-category breakdown.

**Acceptance Criteria:**

- [ ] `benchmarks/src/harness.ts`: `RouteMetrics` interface gains `total_input_tokens`, `total_output_tokens`, `estimated_cost_usd`, `mean_tokens_per_prompt`.
- [ ] Cost computation is parameterized by a `MODEL_PRICING` table in a new file `benchmarks/src/utils/pricing.ts` covering at least: `gpt-4o`, `gpt-4o-mini`, `claude-opus-4-7`, `claude-sonnet-4-6`. Use public list prices as of 2026-06; document the source in a comment.
- [ ] Summary table in `report.md` adds columns: `tokens (in/out)`, `cost (USD)`.
- [ ] Per-prompt detail table adds a column: `cost (USD)` showing the sum across routes for that prompt.
- [ ] `result.schema.json` accepts the new optional `RouteMetrics` fields without breaking existing schema-validate tests.
- [ ] Regression: `pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A,B,C --prompts P001,P002 --rounds 1` still exits 0 and `report.md` is well-formed (tokens / cost will be 0 in dry-run; that is fine).
- [ ] Verification on existing data: read `packages/dom-shim/SPOT_CHECK_HARD_N10.json` and verify the per-route token counts and costs are sensible (Route A should be MUCH higher than B and C because it embeds the 476-line .d.ts in every system prompt).
- [ ] Commit: `feat(dom-shim): US-151 — aggregate token cost into report`.

### US-152: Wire puppeteer to enable M4 visual scoring

**Description:** Phase 1 wrote HTML preview files as `screenshot_path`, then the visual scorer skipped because the file was not PNG/JPEG. Add a puppeteer step that rasterizes the preview HTML to PNG, then update routes to set `screenshot_path` to the PNG path. M4 then fires for real.

**Acceptance Criteria:**

- [ ] Add `puppeteer ^23.x` (or compatible with Node 22 monorepo conventions) to `packages/dom-shim/package.json` devDependencies.
- [ ] Create `benchmarks/src/scoring/rasterize.ts` exporting `async function rasterizePreview(htmlPath: string, outPngPath: string, opts?: {width?: number; height?: number}): Promise<void>`. Default viewport 800×1200 per RUBRIC.md M4. Reuse a single browser instance across the run (lazy singleton) so we are not paying browser-launch cost per record.
- [ ] Hook the rasterize call into each route runner (A, B, C) right after the preview HTML is written: write PNG next to the HTML, set `screenshot_path` to the PNG path.
- [ ] On rasterize failure, log the error to `error_log` but still proceed (do not crash the run). `screenshot_path` becomes null, visual_score stays null with rationale "rasterize failed".
- [ ] Browser closed cleanly at end of run via `process.on('exit')` or harness shutdown hook.
- [ ] Re-run the existing hard n=10 spot check command (`--prompts P007,P014,P015,P023,P029,P030,P034,P041,P048,P049 --rounds 3 --model gpt-4o`). Verify `visual_score` is now a numeric 0..1 for each render_ok=true record. Save to `packages/dom-shim/SPOT_CHECK_HARD_N10_V2.{md,json}`.
- [ ] Regression: dry-run smoke still passes (puppeteer must lazy-init only when actually rendering).
- [ ] Commit: `feat(dom-shim): US-152 — wire puppeteer rasterization for M4 visual scoring`.

### US-153: Tighten mock PAPI / mock Shim to reject unknown tags

**Description:** Phase 1 mock PAPI accepts any tag name via `__CreateElement(tag)` fallback, which makes Route A and B unrealistically forgiving compared to Route C's strict JSON schema enum. Bring them onto the same fairness footing.

**Acceptance Criteria:**

- [ ] `benchmarks/src/mocks/mock-papi.ts`: add `ALLOWED_LYNX_TAGS = new Set(['page','view','text','image','scroll-view','list','raw-text','wrapper','none','if','for','block','input','button','svg'])` (extend conservatively if the real Lynx engine accepts more). `__CreateElement(tag)` throws `Error("Unknown Lynx tag: " + tag)` if not in the set.
- [ ] `mock-shim.ts`: `document.createElement(tag)` likewise throws on unknown tag. Wraps the underlying mock-papi throw into a recognizable DOM-style error so the LLM sees a useful round-N+1 message.
- [ ] Update Route C JSON schema (`routes/route-c-schema.json`) `tag` enum to match `ALLOWED_LYNX_TAGS` exactly so the three routes share the same surface.
- [ ] Re-run the hard n=10 with `--rounds 3`. **Expect** Route A and Route B one-shot render_ok to drop somewhat (gpt-4o will probably emit `div` or `span` at least once). Save to `packages/dom-shim/SPOT_CHECK_HARD_N10_V3.{md,json}`.
- [ ] Commit: `feat(dom-shim): US-153 — enforce Lynx tag enum in mock PAPI and Shim`.

### US-154: Multi-model support + cost estimator

**Description:** Phase 1 CLI accepts `--model X` (single). Add `--models X,Y` (multi) so the harness loops models and writes a per-model report. Also add `--estimate-only` to print predicted token cost without firing any LLM call — required for the US-155 budget gate.

**Acceptance Criteria:**

- [ ] `benchmarks/cli.ts`: accept `--models gpt-4o,claude-opus-4-7` (comma-separated). When passed, ignore `--model`. When `--model` alone is passed, behave as before (single model).
- [ ] When multi-model, `out_dir/<model_id>/report.{md,json}` per model, plus `out_dir/cross_model_summary.md` with a side-by-side table of all routes × all models on all 4 metrics.
- [ ] `--estimate-only` flag: walk the corpus and routes selected, compute estimated input tokens (system prompt size × N × rounds), output a single line of `Estimated cost: $X.XX (range $Y..$Z)` to stdout, exit 0 without any LLM call. Useful before kicking off big sweeps.
- [ ] `benchmarks/src/llm/anthropic-client.ts`: add `estimateInputTokens(system: string, user: string): number` using a simple `chars / 4` heuristic (or `tiktoken` if it is already in the monorepo — check, do not pull a new dep just for this).
- [ ] Verify: `pnpm -F @lynx-js/dom-shim benchmark --estimate-only --all --routes A,B,C --rounds 3 --models gpt-4o,claude-opus-4-7` prints a sensible estimate (should be in the $20..$60 range; if WAY off, something is wrong).
- [ ] Commit: `feat(dom-shim): US-154 — multi-model support and --estimate-only`.

### US-155: Run the n=50 full sweep and write the decision document

**Description:** With US-151..154 in place, the n=50 × 3-route × N=3 × 2-model sweep is the final Phase 1.5 deliverable. **This story has a human-approval gate** — Ralph must stop BEFORE running the live sweep and request explicit confirmation.

**Acceptance Criteria:**

**Pre-flight (Ralph does this alone):**

- [ ] Run `--estimate-only --all --routes A,B,C --rounds 3 --models gpt-4o,claude-opus-4-7` and record the estimated cost.
- [ ] Verify all of US-151..154 commits are on the branch and the dry-run smoke still passes.

**Gate (Ralph MUST stop here):**

- [ ] Output a message that includes: estimated cost, the exact command to run, predicted runtime, and the literal sentence "AWAITING HUMAN APPROVAL — reply 'go' in chat or rerun this story with `--ack-cost <estimate>` to proceed." Do NOT execute the sweep. Do NOT emit the completion promise.
- [ ] If the human re-runs the story with `--ack-cost <value>` matching the estimate (or higher), proceed. Otherwise stay parked.

**Execution (only after human approval):**

- [ ] Run the full sweep. Estimated 10-30 minutes wall clock. Pipe output to `packages/dom-shim/sweep_<timestamp>.log`.
- [ ] Copy the per-model report artifacts to `packages/dom-shim/PHASE_1_DECISION/<model_id>/report.{md,json}` and the cross-model summary to `packages/dom-shim/PHASE_1_DECISION/cross_model_summary.md`.

**Decision document (Ralph writes this):**

- [ ] `packages/dom-shim/PHASE_1_DECISION/RECOMMENDATION.md` with sections:
  - Headline numbers — 3 routes × 2 models × 4 metrics
  - Per-category breakdown (interactive, form, layout, list, media, navigation, data-display)
  - Per-complexity breakdown (trivial, simple, moderate, complex)
  - Token cost summary — per-route per-prompt cost; per-route total cost; cost-per-render_ok unit
  - M4 visual fidelity — distribution + outliers
  - Failure analysis — top 5 error patterns per route per model
  - Recommendation matrix
  - Caveats that survive Phase 1.5
- [ ] **Recommendation logic** (apply mechanically, do not editorialize):
  - **GO on Shim** if Route B render_ok > Route A by ≥10pp OR Route B cost/render_ok < Route A cost/render_ok by ≥30% OR Route B M4 mean > Route A M4 mean by ≥0.10 on any model.
  - **NO-GO on Shim** if Route A matches or exceeds Route B across all metrics on both models.
  - **MIXED / NEED-MORE-DATA** otherwise; explicitly say so.
- [ ] Commit: `feat(dom-shim): US-155 — Phase 1 decision document from n=50 multi-model sweep`.
- [ ] Output the promise: `<promise>PHASE_1_5_DONE</promise>`.

---

## 3. Functional Requirements (Phase 1.5)

- **FR-1.5.1** No new top-level package. All work in existing `packages/dom-shim/`.
- **FR-1.5.2** No new third-party deps beyond `puppeteer`. If puppeteer install fails on this monorepo, fall back to `playwright` (single substitution; do not chase a third option).
- **FR-1.5.3** Backward compatibility: `--model X` (single) flag continues to work as in Phase 1. `--dry-run` continues to short-circuit before any LLM or browser call.
- **FR-1.5.4** Pricing data lives in one file and is the only place that needs updating when prices change. No price hard-coded in routes or scorer.
- **FR-1.5.5** All artifacts under `packages/dom-shim/PHASE_1_DECISION/` are committed. Reports that exceed 1MB get a `.json` next to the `.md` but are otherwise plain markdown.
- **FR-1.5.6** Cost gate (US-155) is the only human-approval step. Everything else runs autonomously.

---

## 4. Non-Goals (Phase 1.5)

- Web library interop benchmark (separate Phase 1.6 effort; not blocking RFC decision).
- Real Lynx engine integration (still Phase 4+ territory).
- Tier specification / type hierarchy (Phase 2).
- Production-quality DOM Shim implementation (Phase 4).
- Any change to the original `PRD.md` user stories (Phase 1 is closed; treat US-101..109 commits as immutable).
- Re-running the full sweep more than once. If the first run produces clean data, ship it. If it surfaces a new harness bug, fix → re-run small (n=10) to verify → escalate to human before re-running n=50.

---

## 5. Technical Considerations

### 5.1 Pricing reference (as of 2026-06; verify against current price page)

| Model               | Input ($/1M tok) | Output ($/1M tok) |
| ------------------- | ---------------- | ----------------- |
| `gpt-4o`            | $2.50            | $10.00            |
| `gpt-4o-mini`       | $0.15            | $0.60             |
| `claude-opus-4-7`   | $15.00           | $75.00            |
| `claude-sonnet-4-6` | $3.00            | $15.00            |

These numbers may be stale at execution time. Verify against the provider pricing page and update `pricing.ts` if any have moved by >10%.

### 5.2 Estimated Phase 1.5 LLM cost

- US-152 re-run (n=10, single model): ~$3
- US-153 re-run (n=10, single model): ~$3
- US-154 `--estimate-only` smoke: $0
- US-155 sweep (n=50 × 3 routes × 3 rounds × 2 models): ~$30-60 depending on actual convergence rate (early-convergence cells skip later rounds)

**Total Phase 1.5 budget envelope: ~$50** (one-time, not recurring).

### 5.3 Puppeteer in this monorepo

- pnpm-workspace.yaml is explicit-list (not glob); `packages/dom-shim` is already registered (Phase 1), no new line needed.
- Puppeteer downloads a Chromium binary on install (~150MB). Consider `PUPPETEER_SKIP_DOWNLOAD=1` if a system Chrome is available; otherwise allow the download.
- The corporate network may also need `NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem` to download the Chromium binary. Pre-stage that.

### 5.4 Environment (must be exported before any pnpm/node command)

```bash
export PATH="/Users/bytedance/.nvm/versions/node/v22.19.0/bin:$PATH"
export NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem
export OPENAI_API_KEY=<key>   # or ANTHROPIC_API_KEY; auto-detected
```

The benchmark client picks provider per env. Phase 1.5 needs **both** keys exported for US-155 multi-model.

### 5.5 Carry-over lint contract from Phase 1

(Quoted from `scripts/ralph-benchmark/progress.txt` — do not relearn these.)

- ESLint forbids `process.exit()` → `throw new Error()`
- Biome forbids `console.log` → `console.info`
- TS is on `strictest` + `verbatimModuleSyntax` + `isolatedDeclarations`
- `n/file-extension-in-import: 'always'` already overridden for `packages/dom-shim/**/*.ts` (eslint.config.js)
- Biome `useAwait`: no `async` without `await` — use `Promise.resolve/reject` for sync paths
- ESLint `unicorn/consistent-function-scoping`: hoist `noop` and similar to module scope
- `n/no-unsupported-features/node-builtins` already mollified by `engines.node: '^22 || ^24'` in package.json

---

## 6. Success Metrics for Phase 1.5

Phase 1.5 succeeds when one of:

- **Clear-go signal** produced (recommendation = GO on Shim with explicit metric threshold met), with caveats enumerated.
- **Clear-no-go signal** produced (recommendation = NO-GO on Shim, RFC stays at raw PAPI), with caveats enumerated.
- **Mixed signal** explicitly reported, with the specific extra experiment needed to resolve identified.

In all three cases the output is a single committed `RECOMMENDATION.md` that the human can paste into the original Lark RFC comments. **Phase 1.5 does not declare success without that file.**

---

## 7. Open Questions (resolved by Phase 1.5 data; do NOT block on these)

These are for the Phase 2 decision-maker, not for Ralph:

- **OQ-1.5.1** If GO: does the data support default-strict (`SafeWritableElement`) or default-permissive (`UnsafeWritableElement`) for LLM consumers? (OQ-6 in Phase 1 PRD.)
- **OQ-1.5.2** If GO: token-cost data should decide whether the Shim ships its system prompt as a separate `@lynx-js/dom-shim/llm-system-prompt.md` artifact or inline.
- **OQ-1.5.3** If NO-GO: should we still ship the testing-environment Shim (parallel branch `Huxpro/lynx-dom-shim`, 10 stories done) as a separate use case?

---

## 8. References

- `PRD.md` — Phase 1 PRD, the source of truth on US-101..109
- `REPORT.md` — Phase 1 full-program report, the canonical data summary
- `SPOT_CHECK_FINDINGS.md` — the n=10 data and its surprises that motivated Phase 1.5
- `SPOT_CHECK_HARD_N10.{md,json}` — the existing dataset that US-151 can validate against
- `scripts/ralph-benchmark/progress.txt` — Phase 1 execution log + lint contract notes
- `packages/dom-shim/benchmarks/RUBRIC.md` — the metric definitions (unchanged in Phase 1.5)
- React Native [`ReadOnlyNode`](https://reactnative.dev/docs/nodes) — design inspiration (for context only)
- Bytetech RFC original — https://bytedance.larkoffice.com/wiki/HXJBwkT4uikoPEk0sQucaHvdnHh (for context only)

---

## 9. Ralph Agent Boot Sequence

If you are the Ralph autonomous agent picking up this PRD:

1. **Read these files in this order:** this PRD, then `REPORT.md` (5 min skim), then `scripts/ralph-benchmark/progress.txt` (the "Notes for next iteration" block).
2. **Execute US-151 through US-155 in numerical order.** Each story's acceptance criteria must pass before moving to the next.
3. **All commands must export the environment first** (Section 5.4). Cwd does not persist across Bash calls — use absolute paths.
4. **Commit cadence:** one commit per completed story; format `feat(dom-shim): US-1NN — <title>` or `fix(dom-shim): ...`. Branch stays `Huxpro/lynx-dom-shim-benchmark`.
5. **US-155 has a HARD STOP gate** between pre-flight and execution. After pre-flight, output the human-approval prompt and DO NOT continue until the next iteration sees explicit acknowledgment (either a chat message or a re-invocation with `--ack-cost` matching the estimate). Do NOT emit `PHASE_1_5_DONE` before US-155's decision document is committed.
6. **When you finish:** the committed `packages/dom-shim/PHASE_1_DECISION/RECOMMENDATION.md` is the deliverable. Once that file exists and US-155 commit is on the branch, output:

   ```
   <promise>PHASE_1_5_DONE</promise>
   ```

7. **When in doubt about whether something is in scope:** if it is not in Section 2's user stories, it is NOT in scope. Phase 2 is a separate PRD that will be written AFTER Phase 1.5 data is in hand. Do not start any Phase 2 work in this loop.
8. **Maintain progress state** in `scripts/ralph-benchmark/progress_15.txt` (new file; do not mutate the Phase 1 `progress.txt`).
9. **Blocker handling:** if puppeteer install fails on the corporate network, try `PUPPETEER_SKIP_DOWNLOAD=1` + manual Chromium path. If that also fails after one good-faith attempt, mark US-152 as BLOCKED in progress_15.txt, skip to US-153, and continue. Report the blocker in the final RECOMMENDATION.md "Caveats that survive Phase 1.5" section.

---

## 10. Suggested Ralph Launch

Open a fresh Claude session at the worktree, then:

```bash
# In the session, first turn:
/ralph-loop --max-iterations 30 --completion-promise PHASE_1_5_DONE \
    "Read PRD.md, REPORT.md, and Phase_1_5_PRD.md in full. \
     Section 9 of Phase_1_5_PRD.md is your authoritative boot sequence. \
     Branch is Huxpro/lynx-dom-shim-benchmark. \
     Worktree absolute path is /Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark. \
     cwd does not persist across Bash calls so use absolute paths. \
     ALWAYS export: PATH=/Users/bytedance/.nvm/versions/node/v22.19.0/bin:\$PATH AND \
     NODE_EXTRA_CA_CERTS=/tmp/all-cas.pem AND \
     OPENAI_API_KEY=<key> AND ANTHROPIC_API_KEY=<key>. \
     Track progress in scripts/ralph-benchmark/progress_15.txt. \
     US-155 has a HARD STOP human-approval gate; do not proceed past it without explicit ack. \
     When the recommendation document is committed, emit PHASE_1_5_DONE inside a promise tag."
```

Allocate ~30 iterations because:

- US-151 (~30 min real work, 1-2 iterations)
- US-152 (~2-3h with puppeteer headaches, 4-8 iterations)
- US-153 (~1h, 2-3 iterations)
- US-154 (~30 min, 1-2 iterations)
- US-155 pre-flight (~1 iteration), gate wait (1-N iterations of human-check short-circuit), execution + decision doc (~3-5 iterations)

If Ralph hits iteration 30 before the gate is approved, the human can reset and resume; data already collected up to that point is committed.
