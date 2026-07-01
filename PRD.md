# PRD: Lynx DOM Shim — LLM-Native Output Layer

> **Status:** Draft for Ralph autonomous-agent execution
> **Branch:** `Huxpro/lynx-dom-shim-benchmark`
> **Worktree:** `~/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark/`
> **Package path:** `packages/dom-shim/`
> **Phase under execution:** Phase 1 only (benchmark). Subsequent phases are outlined for context; do not start them.

## Related Work — Read This First

A parallel session on branch `Huxpro/lynx-dom-shim` built a related but distinct DOM Shim inside `packages/testing-library/testing-environment/src/dom-shim/`. That work targets the **testing environment** use case (jest-DOM-style assertions over Lynx element trees). 10 stories landed, 130/130 tests green.

**Their tier model is similar to ours but uses a different 5th level (`AsyncNative`) instead of our `SafeWriteOnly` (events).** Reference their work for design validation, but do not depend on it — this branch is a separate effort focused on **LLM output validation** rather than testing.

Reference paths:
- `packages/testing-library/testing-environment/src/dom-shim/capabilities.ts` (their tier contract)
- `scripts/ralph/prd.json` (their PRD — different motivation)

---

## 1. Introduction / Overview

Lynx exposes a low-level Element PAPI (~80 global `__XXX` functions like `__CreateView`, `__SetAttribute`, `__AppendElement`, `__QuerySelector`, `__FlushElementTree`). The existing RFC ["LLM 直出 Lynx 原生产物"](https://bytedance.larkoffice.com/wiki/HXJBwkT4uikoPEk0sQucaHvdnHh) proposes letting LLMs emit code that calls these PAPI functions directly. But that conflicts with its own motivation — LLM training corpora are heavy in **standard HTML/CSS/JS**, not in private `__XXX` PAPI calls.

This project proposes building a **tiered DOM API Shim** on top of Element PAPI, so LLMs can emit standard HTML + DOM JavaScript that runs natively on Lynx. The design is inspired by React Native's `ReadOnlyNode` / `ReadOnlyElement` / `ReactNativeElement` hierarchy, but goes further on the write side and explicitly names the messy middle (`UnsafeWritableElement`) where APIs run but semantics drift.

**This PRD is a 6-phase plan. Phase 1 is a validation benchmark that must produce data before any further phase is committed.** If Phase 1 numbers do not justify the Shim path, the project is killed cleanly with the data as deliverable.

---

## 2. Goals

- **Phase 1 (immediate):** Produce hard data comparing three LLM-output routes (raw PAPI / DOM Shim / A2UI JSON) across 4 metrics, so the path choice is data-driven rather than vibes-driven.
- **Long-term (if Phase 1 justifies):** Ship `@lynx-js/dom-shim` as a tiered DOM API layer where:
  - LLM-emitted standard HTML / DOM JS code runs on Lynx with ≥70% one-shot success rate
  - Existing web libraries that only *read* DOM (react-virtual, focus-trap, popper.js measurement) run unchanged
  - TodoMVC vanilla runs unchanged (smoke test bar)
  - WPT `dom/` subset reaches ≥85% pass rate
  - Each tier (ReadOnly / SafeWrite / UnsafeWrite / Unsupported) has documented invariants and structured error diagnostics

---

## 3. User Stories — Phase 1 (Ralph executes these)

### US-101: Set up `packages/dom-shim/` workspace package skeleton

**Description:** As the Ralph agent, I need a properly registered pnpm workspace package so subsequent benchmark code has a home.

**Acceptance Criteria:**
- [ ] `packages/dom-shim/package.json` created with name `@lynx-js/dom-shim`, version `0.0.0`, `private: true`
- [ ] Package registered in root `pnpm-workspace.yaml` (likely covered by `packages/*` glob — verify)
- [ ] `packages/dom-shim/tsconfig.json` extends repo root preset
- [ ] `packages/dom-shim/README.md` with one-paragraph project intent + link to this PRD
- [ ] `packages/dom-shim/benchmarks/` directory created
- [ ] `pnpm install` completes without error
- [ ] `pnpm -F @lynx-js/dom-shim typecheck` passes (empty pass is fine)
- [ ] Commit: `feat(dom-shim): US-101 — set up workspace package skeleton`

### US-102: Hand-curate 50-prompt LLM-DOM corpus

**Description:** As the benchmark designer, I need 50 representative LLM prompts that span the page types LLMs are typically asked to generate.

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/corpus/prompts.json` with exactly 50 entries
- [ ] Each entry shape:
  ```jsonc
  {
    "id": "P001",
    "category": "interactive" | "form" | "layout" | "list" | "media" | "navigation" | "data-display",
    "prompt": "Build a counter component with +1 and -1 buttons. Display the current value prominently.",
    "expected_capabilities": ["click event", "state update", "text content set"],
    "complexity": "trivial" | "simple" | "moderate" | "complex"
  }
  ```
- [ ] Category distribution: no category < 5 or > 12 entries
- [ ] Complexity distribution: ~15 trivial, ~20 simple, ~10 moderate, ~5 complex
- [ ] Prompts cover canonical LLM-page categories — full list in §3 above (counter, todo list, form validation, modal dialog, tabs, accordion, dropdown menu, card grid, image gallery, search input with results, navbar, footer, pricing table, login form, settings page, profile card, notification toast, progress bar, slider, date picker, tooltip, breadcrumb, pagination, stepper, table, chart placeholder, hero section, FAQ list, comment thread, chat message list, kanban column, calendar view, color picker, file upload UI, tag input, rating stars, switch/toggle, video player UI, audio player UI, code editor UI, markdown preview, banner alert, empty state, loading skeleton, badge collection, avatar list, two-column layout, timeline, score board, simple landing page)
- [ ] Each `expected_capabilities` is concrete (e.g. "click event", "innerHTML set", "classList toggle", "style.display change")
- [ ] A schema validator (`packages/dom-shim/benchmarks/scripts/validate-corpus.ts`) checks shape + count
- [ ] Commit: `feat(dom-shim): US-102 — curate 50-prompt LLM-DOM corpus`

### US-103: Define scoring rubric and metric collection schema

**Description:** As the benchmark designer, I need a written rubric so each of the 3 routes is scored against the same yardstick.

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/RUBRIC.md` documenting:
  - **One-shot parse rate:** LLM-emitted artifact parses / loads without crash on first generation
  - **One-shot render rate:** Artifact renders visible non-blank output on first generation (requires parse success)
  - **N-round convergence rate (N=3):** Within 3 LLM self-repair rounds (error fed back), artifact renders correctly
  - **Visual similarity to intent:** Vision LLM scores artifact screenshot vs prompt description on 0–5 scale, normalized to 0–1
- [ ] File `packages/dom-shim/benchmarks/schema/result.schema.json` JSON schema for per-prompt result records, with fields: `prompt_id`, `route` (A/B/C), `round` (1..3), `generated_code`, `parse_ok`, `render_ok`, `screenshot_path`, `error_log`, `visual_score`, `timestamp`, `model_id`, `tokens_used`
- [ ] Aggregate report shape documented: per-route metric tuple + per-category breakdown + raw record array
- [ ] Commit: `feat(dom-shim): US-103 — define benchmark scoring rubric and result schema`

### US-104: Build benchmark harness (orchestrator)

**Description:** As the benchmark runner, I need a single CLI entry point that drives all 3 routes against all 50 prompts.

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/src/harness.ts` exports `runBenchmark(routes, prompts, opts): Promise<BenchmarkReport>`
- [ ] CLI entry `packages/dom-shim/benchmarks/cli.ts` runnable via `pnpm -F @lynx-js/dom-shim benchmark` with flags:
  - `--routes A,B,C` (subset selectable)
  - `--prompts P001,P002` (subset selectable) OR `--all`
  - `--rounds 3` (N for convergence metric)
  - `--model claude-opus-4-7`
  - `--out ./reports/<timestamp>/`
  - `--dry-run`
  - `--concurrency N` (default 4)
- [ ] Harness writes per-prompt JSONL results streaming during run (recoverable on crash)
- [ ] Harness produces final `report.json` + `report.md`
- [ ] Transient API errors auto-retry 3x with exponential backoff
- [ ] `pnpm -F @lynx-js/dom-shim benchmark --dry-run --routes A --prompts P001` exits 0
- [ ] Commit: `feat(dom-shim): US-104 — build benchmark harness CLI`

### US-105: Implement Route A runner — raw Element PAPI direct output

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/src/routes/route-a-papi.ts`
- [ ] Route A system prompt embeds full `@lynx-js/type-element-api@0.0.8` `.d.ts`
- [ ] Asks LLM to emit TypeScript exporting `function render(rootPageRef: PageElementRef): void`
- [ ] Validates output:
  - Parse via TypeScript compiler API (parse_ok)
  - Load into mock PAPI runtime that records API calls (`packages/dom-shim/benchmarks/src/mocks/mock-papi.ts`)
  - At least one `__CreateXxx` + one `__AppendElement` + one `__FlushElementTree` (render_ok proxy)
- [ ] Mock PAPI shared with Route B for apples-to-apples
- [ ] Static HTML preview renderer for visual scoring: `view` → `<div>`, `text` → `<span>`, `image` → `<img>`
- [ ] Per-round error feedback fed back to LLM for round N+1
- [ ] Commit: `feat(dom-shim): US-105 — implement Route A raw PAPI runner`

### US-106: Implement Route B runner — DOM Shim (mock implementation)

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/src/routes/route-b-shim.ts`
- [ ] System prompt instructs LLM to emit HTML + optional `<script>` targeting Lynx-flavored DOM where:
  - Elements are `<view>`, `<text>`, `<image>`, `<scroll-view>`, `<input>`, `<button>`
  - Standard DOM API available: `document.createElement`, `appendChild`, `setAttribute`, `addEventListener('click', fn)`, `classList`, `style.X = v`, `innerHTML = ...`, `querySelector`
- [ ] File `packages/dom-shim/benchmarks/src/mocks/mock-shim.ts` implements minimal DOM Shim (~300 LOC) that:
  - Wraps mock PAPI from US-105
  - Supports L1 ReadOnly + L2 SafeWrite + minimal L3 `innerHTML` parser (`htmlparser2`)
  - Records every PAPI call for comparison
- [ ] LLM code runs inside Shim via `vm.runInNewContext` with mock globals
- [ ] Same error feedback loop and screenshot pipeline as Route A
- [ ] Commit: `feat(dom-shim): US-106 — implement Route B DOM Shim mock runner`

### US-107: Implement Route C runner — A2UI / JSON DSL

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/src/routes/route-c-a2ui.ts`
- [ ] System prompt references A2UI shape (reference: existing `packages/genui/a2ui-playground/`)
- [ ] LLM emits JSON matching a typed schema (`packages/dom-shim/benchmarks/src/routes/route-c-schema.json`)
- [ ] JSON validated against schema (parse_ok)
- [ ] JSON walked into mock PAPI calls (render_ok)
- [ ] Same screenshot + scoring pipeline
- [ ] Commit: `feat(dom-shim): US-107 — implement Route C A2UI JSON runner`

### US-108: Implement visual similarity scoring

**Acceptance Criteria:**
- [ ] File `packages/dom-shim/benchmarks/src/scoring/visual.ts` exports `scoreVisualSimilarity(screenshotPath, prompt): Promise<{score, rationale}>`
- [ ] Uses Claude vision (Opus 4.7) as default; supports OpenAI fallback via `BENCHMARK_VISION_API` env var
- [ ] System prompt: "Rate 0–5 how well this screenshot matches the prompt description. Consider: presence of described elements, basic layout correctness, visual quality. Return JSON `{score, rationale}`."
- [ ] Returns normalized 0–1 score
- [ ] Caches results to `packages/dom-shim/benchmarks/cache/visual-scores.json` keyed by `(screenshot_hash, prompt_id)`
- [ ] Commit: `feat(dom-shim): US-108 — implement visual similarity scoring`

### US-109: Generate comparison report (Phase 1 acceptance gate)

**Acceptance Criteria:**
- [ ] Harness output includes `report.md` with sections:
  - Summary table: 3 routes × 4 metrics
  - Per-category breakdown: routes × metrics × category
  - Per-prompt detail: 50 prompts × per-route results
  - Failure analysis: top 5 most common error patterns per route
  - Visual examples: for 5 representative prompts, side-by-side screenshots from each route
  - Recommendation: auto-filled if any route's render_ok rate exceeds others' by ≥20pp
- [ ] `report.json` schema-validated per US-103
- [ ] **Smoke test acceptance gate:** Run on `--prompts P001,P002 --routes A,B,C --rounds 1` end-to-end successfully. Report artifacts manually inspectable.
- [ ] **Stop here.** Do not run the full 50×3×3 sweep without explicit human approval.
- [ ] Commit: `feat(dom-shim): US-109 — generate Phase 1 comparison report`

---

## 4. Phase 2+ — Forward-looking outline (DO NOT START)

These exist for context only.

- **Phase 2:** Tier specification — class hierarchy `ReadOnlyNode` → `ReadOnlyElement` → `SafeWritableElement` → `SafeWriteOnlyElement` → `UnsafeWritableElement`; resolve threading / flush / parser open questions.
- **Phase 3:** Element PAPI gap patches — `__PrevElement`, `__RemoveAttribute`, `__RemoveClass`, `__RemoveEvent`, `__RemoveInlineStyle`, `__GetInlineStyleByName`, sync main-thread `boundingClientRect`.
- **Phase 4:** Real Shim implementation by tier — L1 (1-2 wk) → L2 (2-3 wk, TodoMVC exit) → L3 with HTML parser (3-4 wk, ≥70% v0/Artifacts samples exit) → L4 Unsupported throw paths.
- **Phase 5:** Conformance — WPT subset (`dom/nodes`, `dom/events`, `dom/lists`, `html/dom`, `css/cssom`, `selectors`), TodoMVC vanilla, 100-prompt agent-loop benchmark, publish `baseline.json` + dashboard.
- **Phase 6:** Structured diagnostic protocol for LLM agent loop integration (Harness/nodelynx).

---

## 5. Functional Requirements (Phase 1)

- **FR-1:** Package `@lynx-js/dom-shim` lives at `packages/dom-shim/`, marked private.
- **FR-2:** Benchmark CLI invocable via `pnpm -F @lynx-js/dom-shim benchmark [flags]`.
- **FR-3:** Benchmark accepts `--routes`, `--prompts`, `--rounds`, `--model`, `--out`, `--concurrency`, `--dry-run` flags.
- **FR-4:** Benchmark streams results to JSONL; recoverable on crash.
- **FR-5:** Benchmark produces `report.json` + `report.md`.
- **FR-6:** All three routes use the same mock Element PAPI runtime.
- **FR-7:** All three routes use the same screenshot pipeline (Puppeteer) and same visual scoring model.
- **FR-8:** LLM API key from `ANTHROPIC_API_KEY` (Claude default) or `OPENAI_API_KEY`.
- **FR-9:** Vision scoring API key via `BENCHMARK_VISION_API` env var.
- **FR-10:** All LLM calls logged verbatim to per-run audit file.
- **FR-11:** End-to-end on 5-prompt subset within 5 minutes.
- **FR-12:** Mock PAPI implements at minimum: `__CreatePage`, `__CreateView`, `__CreateText`, `__CreateImage`, `__CreateRawText`, `__SetAttribute`, `__SetClasses`, `__SetInlineStyles`, `__AddEvent`, `__AppendElement`, `__RemoveElement`, `__InsertElementBefore`, `__GetParent`, `__GetChildren`, `__FlushElementTree`.
- **FR-13:** Mock DOM Shim implements at minimum: `document.createElement`, `document.querySelector`, `Element.appendChild`, `Element.setAttribute`, `Element.addEventListener`, `Element.classList.{add,remove,toggle}`, `Element.style.X = v`, `Element.innerHTML = v` (htmlparser2).

---

## 6. Non-Goals

**Phase 1:**
- Real Lynx engine integration — Phase 1 uses mock PAPI only.
- Production-grade Shim — Phase 1 mock is ~300 LOC, throwaway.
- Real device / iOS / Android testing.
- Real cross-thread modeling — mock is single-threaded.
- Engine-side PAPI changes (Phase 3 territory).
- Tier specification / type hierarchy (Phase 2 territory).
- WPT conformance (Phase 5 territory).
- TodoMVC smoke test (Phase 4 exit criterion).

**Project-wide:**
- Shadow DOM, `attachShadow`
- `customElements.define` front-end registration
- Full CSSOM
- `document.cookie` / `localStorage` / `location` / `history`
- `MutationObserver` (may revisit in Phase 6+)
- Full Web event model (`PointerEvent`, `KeyboardEvent`, `DragEvent`)
- jsdom-level conformance

---

## 7. Technical Considerations

### Mock runtime architecture

```
LLM ── prompt + system prompt for route ──┐
                                          ▼
                                   [Route runner]
                                          │
                                          ▼
                                  [vm.runInNewContext sandbox]
                                          │
                                          ▼
                        [Mock Element PAPI / Mock DOM Shim]
                                          │
                                          ▼
                        [Recorded PAPI call sequence]
                                          │
                                          ▼
                        [Static HTML preview renderer]
                                          │
                                          ▼
                                 [Puppeteer screenshot]
                                          │
                                          ▼
                                 [Vision LLM scorer]
                                          │
                                          ▼
                                 [Result record JSONL]
```

### Dependencies for Phase 1

- `@anthropic-ai/sdk` — Claude LLM
- `openai` — fallback / vision option
- `htmlparser2` — minimal HTML parser in mock Shim
- `puppeteer` — headless screenshot
- `typescript` — compiler API for parse-time validation
- `vitest` — repo convention
- `ajv` — JSON schema validation
- `zod` — runtime schema types (verify version alignment with monorepo)

### Element PAPI gaps (Phase 3 future work)

Documented here for context, not blocking Phase 1:

- `__PrevElement`, `__RemoveAttribute`, `__HasAttribute`, `__RemoveClass`, `__RemoveEvent`, `__RemoveInlineStyle(node, propertyId)`, `__GetInlineStyleByName(node, string)`, main-thread sync `boundingClientRect`.

---

## 8. Success Metrics

### Phase 1 success criteria

Phase 1 succeeds by **producing data that supports a clear go/no-go decision**, not by hitting a specific number:

- **Go signal:** Route B render_ok ≥ Route A render_ok + 15 percentage points
- **Stronger go:** Route B convergence ≥ 80% AND Route A convergence ≤ 60%
- **No-go:** Route A within 5pp of Route B on all metrics
- **Mixed:** Route C beats both — re-evaluate whole approach

### Long-term success metrics (Phase 4+)

- Vanilla TodoMVC runs unchanged
- ≥70% of scraped v0/Bolt/Artifacts samples run within N=3 self-repair rounds
- WPT `dom/nodes` + `dom/events` + `dom/lists` subset ≥85% pass
- Bundle: ReadOnly ≤5KB gzip; SafeWrite +≤10KB; UnsafeWrite +≤30KB
- ≥3 web library import-and-run cases

---

## 9. Open Questions (Phase 2 resolves)

| # | Question | Options | Impact |
|---|----------|---------|--------|
| OQ-1 | Threading model | (a) Main-thread-only (b) Dual-thread two-signature (c) Mixed | Shim API shape |
| OQ-2 | Flush strategy | (a) Auto on microtask (b) Explicit `lynx.dom.flush()` (c) Hybrid | Read-after-write semantics |
| OQ-3 | HTML parser | (a) Self-written ~10KB (b) `htmlparser2` ~30KB (c) `parse5` ~90KB | UnsafeWrite bundle cost |
| OQ-4 | PAPI propertyId vs string | (a) Patch PAPI universally (b) Shim string↔id map (c) Both | Runtime size + PAPI breakage |
| OQ-5 | Package distribution | (a) Standalone npm (b) Inlined in Lynx SDK (c) Both | Install path |
| OQ-6 | Type-system default | (a) Permissive default (b) Strict default | DX |
| OQ-7 | innerHTML inline-script policy | (a) Silently drop (b) Throw structured error (c) Isolated sandbox | Security |
| OQ-8 | Visual scorer (Phase 1) | (a) Claude vision (b) GPT-4V (c) Ensemble | Cost vs reproducibility — **Ralph: default (a)** |
| OQ-9 | Phase 1 LLM | (a) Opus 4.7 (b) Sonnet 4.6 (c) Multi-model matrix | Cost vs signal — **Ralph: default (a)** |
| OQ-10 | Convergence N | (a) N=3 (proposed) (b) N=5 | Phase 1 budget |

---

## 10. References

- **Lynx RFC (origin):** https://bytedance.larkoffice.com/wiki/HXJBwkT4uikoPEk0sQucaHvdnHh
- **Element API docs:** https://lynxjs.org/next/api/engine/element-api/
- **Element API `.d.ts`:** https://unpkg.com/@lynx-js/type-element-api@0.0.8/types/element-api.d.ts
- **RN ReadOnlyNode:** https://reactnative.dev/docs/nodes
- **WPT:** https://github.com/web-platform-tests/wpt
- **jsdom test suite:** https://github.com/jsdom/jsdom
- **TodoMVC vanilla:** https://github.com/tastejs/todomvc
- **A2UI prior art:** `packages/genui/a2ui-playground/` (this monorepo)
- **Parallel testing-environment work:** `packages/testing-library/testing-environment/src/dom-shim/` (this monorepo, branch `Huxpro/lynx-dom-shim`)
- **Cloudflare workerd WPT dashboard model:** https://github.com/cloudflare/workerd

---

## 11. Ralph Agent Instructions — Boot Sequence

If you are the Ralph autonomous agent picking up this PRD:

1. **Execute only Phase 1 stories (US-101 through US-109).** Do not begin Phase 2+ outline items.
2. **Process stories in numerical order.** Each story's acceptance criteria must pass before moving to the next.
3. **For US-102 (corpus):** Hand-write all 50 prompts yourself, drawing from the listed page categories. Do NOT scrape external sites — the corpus must be reproducible and TOS-clean.
4. **For US-104 (harness):** Implement `--dry-run` working before touching real LLM API. Cost control.
5. **For US-108 (visual scorer):** Use Claude vision (Opus 4.7) as default per OQ-8. If API not available, write integration but skip live scoring; mark scores null and note in report.
6. **For US-109 (report):** The smoke test on `--prompts P001,P002 --routes A,B,C --rounds 1` is the Phase 1 **acceptance gate**. Stop after this and report back. **DO NOT** run the full 50×3×3 sweep without explicit human approval.
7. **OQ-8 and OQ-9 (open questions on scoring/model):** Pick defaults (Claude Opus 4.7). Other open questions are Phase 2 concerns; do not block Phase 1.
8. **Commit cadence:** One commit per completed story. Commit message format: `feat(dom-shim): US-NNN — <story title>`. Branch is `Huxpro/lynx-dom-shim-benchmark`.
9. **When in doubt about scope:** Prefer minimal mock satisfying acceptance criteria over polished production code. Phase 1 mock is throwaway.
10. **Reference parallel work:** The branch `Huxpro/lynx-dom-shim` has a testing-environment-focused Shim implementation. Read `packages/testing-library/testing-environment/src/dom-shim/capabilities.ts` for tier model inspiration, but do not import or depend on it — Phase 1 is fully self-contained in `packages/dom-shim/`.
11. **Report back when:** US-109 smoke test passes, OR you hit a blocker requiring human judgment (API key missing, monorepo conventions unclear, acceptance criterion ambiguous after good-faith attempt).
