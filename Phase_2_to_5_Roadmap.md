# Roadmap: Phase 2 → Phase 5

> **Status:** Forward-looking roadmap. NOT executable PRDs.
> **Predecessors:** `PRD.md` (Phase 1), `Phase_1_5_PRD.md` (Phase 1.5).
> **Branch:** `Huxpro/lynx-dom-shim-benchmark`.

## Read This First — Caveats on the Whole Document

This roadmap exists because the user asked for it after Phase 1.5 was already PRD'd. **I argued against writing this before Phase 1.5 data was in hand**, and I still think that's the right framing. Treat this document as:

- A _shape_ of the forward plan to share / socialize / estimate
- **Not** a frozen contract — every user story below has a "rewrite-on-data" caveat
- **Not** Ralph-executable as-is — each phase needs a full PRD with acceptance criteria written **after** the predecessor phase produces its data and resolves its open questions

Specifically:

- **Phase 2 will partially rewrite itself** based on Phase 1.5's RECOMMENDATION.md (GO / NO-GO / MIXED)
- **Phase 3 is engine-team coordination** and depends on their roadmap velocity, not Shim team
- **Phase 4 L3 (innerHTML)** parser choice is OQ-3 in Phase 1 PRD and gets resolved in Phase 2; story shape changes based on the answer
- **Phase 5** scope depends entirely on whether Phase 4 produces a Shim that web libraries actually run on

If Phase 1.5 produces **NO-GO**, this whole roadmap becomes moot — Phase 2 collapses to "write RFC closure document and ship Phase 1 data as the deliverable."

---

## 0. Dependency Diagram

```
Phase 1     → Phase 1.5 → Phase 2     ─┬─→ Phase 3 (engine team)
[done]        [PRD'd]    [tier spec]   │
                                        ├─→ Phase 4 L1 (ReadOnly)
                                        │   [can start parallel to Phase 3,
                                        │    only needs existing read-side PAPI]
                                        │
                                        └─→ Phase 4 L2-L4 (write side)
                                            [blocked on Phase 3]
                                                       │
                                                       ▼
                                            Phase 5 conformance + dashboard
```

**Critical path:** Phase 2 → Phase 3 → Phase 4 L2 → Phase 4 L3 → Phase 5. Total calendar ≈ 3-5 months depending on engine team velocity.

---

## Phase 2 — Tier Specification

**Goal:** Convert the 5-tier mental model from `REPORT.md` §2 into a formal contract: TypeScript class hierarchy, language-level invariants per tier, the diagnostic protocol shape, and an RFC Detailed Design pull-request against the original Lark document.

**Trigger to start:** Phase 1.5 RECOMMENDATION.md committed with verdict = GO or MIXED-leans-GO.

**Estimated duration:** 1-2 weeks.

### Stories

#### US-201: Tier contract document

- Author `packages/dom-shim/SPEC/TIERS.md` listing each of the 5 tiers with: (a) which DOM-surface APIs belong, (b) the semantic invariant, (c) the failure mode if invariant is violated, (d) which Phase 1 PRD OQ this resolves.
- Output is the canonical reference all future code links back to.

#### US-202: Resolve OQ-1 (threading model)

- Pick one of: (a) main-thread-only Shim, (b) dual-thread two-signature, (c) mixed sync-getter / async-mutation.
- **Decision input:** does Phase 1.5 data show that LLMs reliably emit code that lives in one thread? If yes, lean main-thread-only and document the trade-off.
- Output is `SPEC/THREADING.md`.

#### US-203: Resolve OQ-2 (flush strategy)

- Pick one of: (a) auto-flush on microtask, (b) explicit `lynx.dom.flush()`, (c) hybrid (auto for SafeWrite, explicit for batch).
- **Decision input:** does Phase 1.5 data show LLMs forget to call any flush? Then hybrid; otherwise auto.
- Output is `SPEC/FLUSH.md`.

#### US-204: Resolve OQ-3 (HTML parser choice)

- Pick one of: (a) self-written ~10KB, (b) `htmlparser2` ~30KB, (c) `parse5` ~90KB.
- **Decision input:** Phase 1.5 token-cost data. If Route B's prompt cost advantage over Route A is the main RFC justification, bundle size starts to matter; pick smaller parser. If correctness is the main justification, pick parse5.
- Output is `SPEC/HTML_PARSER.md` + Phase 4 dependency lock.

#### US-205: TypeScript class hierarchy skeleton

- Author `packages/dom-shim/src/types/` with the 5 interface tiers and no implementations. Each interface lists exact method signatures from the corresponding spec section.
- Must compile with `strictest` + `verbatimModuleSyntax` + `isolatedDeclarations` (same monorepo rules as Phase 1 benchmark).
- Output: importable interfaces ready for Phase 4 to implement.

#### US-206: Diagnostic protocol JSON schema

- Author `packages/dom-shim/SPEC/DIAGNOSTICS.schema.json` for the structured error returned at every tier boundary violation. Shape: `{code, position, message, suggestion, tier_violated, surface}`.
- Drives Phase 4 L4 Unsupported throw paths and Phase 6 agent-loop integration.

#### US-207: RFC Detailed Design PR back to the original Lark document

- Write the response to the original RFC author with: the 5-tier model, the three resolved open questions, the Phase 1.5 data, and the recommendation. Posted as a comment thread on the Lark doc.
- Output: a Lark doc thread that the RFC reviewers can engage with.

### Phase 2 Exit Criteria

- All 7 stories committed on branch.
- The 3 SPEC docs (THREADING, FLUSH, HTML_PARSER) resolve OQ-1 / OQ-2 / OQ-3 explicitly.
- The TS hierarchy compiles and `pnpm -F @lynx-js/dom-shim typecheck` exits 0.
- A Lark comment thread exists on the original RFC.

### Phase 2 Open Decisions

- **OQ-2.1 (new):** Tier names. Roadmap uses `ReadOnlyNode / ReadOnlyElement / SafeWritableElement / SafeWriteOnlyElement / UnsafeWritableElement / Unsupported`. RN's convention is shorter. Decide before US-205 since names land in the type system.
- **OQ-2.2 (new):** Default tier for LLM-emitted code. Phase 1 PRD OQ-6 (`permissive default` vs `strict default`) becomes a Phase 2 decision, informed by Phase 1.5 data (specifically: which tier does the LLM naturally write at?).
- **OQ-2.3 (new):** Whether to publish `@lynx-js/dom-shim/llm-system-prompt.md` as a versioned artifact alongside the TS package, so LLM prompts can pin to a Shim version. Recommended yes; cost is one extra file in the npm publish.

---

## Phase 3 — Engine-side Element PAPI Gap Patches

**Goal:** Add the missing PAPI primitives identified in Phase 1 §7.3 so Phase 4 doesn't need to ship hacks around their absence.

**Trigger to start:** Phase 2 US-205 committed (the hierarchy commits us to needing these gaps closed).

**Estimated duration:** 4-8 weeks of calendar, depending on Lynx engine team velocity. The Shim team's own work is ~1 week of preparation + review participation.

**Important:** Phase 3 work happens in the `lynx-family/lynx` engine repo, NOT this branch. Coordination via PR. Shim team owns the API design but engine team owns the implementation.

### Stories

#### US-301: `__PrevElement` (previousSibling)

- Engine adds primitive for prev-sibling traversal. Currently Shim has to walk parent's children to find previousSibling, O(n) per access.
- Spec: `function __PrevElement(node: ElementRef): ElementRef | undefined`.

#### US-302: `__RemoveAttribute` / `__HasAttribute`

- Engine adds explicit remove (currently must `__SetAttribute(node, name, undefined)` which is semantically lossy) and presence check.
- Spec: `function __RemoveAttribute(node, name): void` and `function __HasAttribute(node, name): boolean`.

#### US-303: `__RemoveClass`

- Engine adds single-class removal so classList.remove doesn't require `__SetClasses` full-replace.
- Spec: `function __RemoveClass(node, className): void`.

#### US-304: `__RemoveEvent` (single handler removal)

- Engine adds removal of a single registered handler. Currently `__SetEvents` full-replace is the only way; that's lossy for multi-handler scenarios.
- Spec: `function __RemoveEvent(node, type, name): void`.

#### US-305: `__RemoveInlineStyle` / `__GetInlineStyleByName`

- Engine adds removal of a single style property + string-keyed getter (current `__GetInlineStyle` takes numeric `propertyId` which is internal-runtime detail).
- Spec: `function __RemoveInlineStyle(node, prop: string): void` and `function __GetInlineStyleByName(node, prop: string): string`.

#### US-306: Main-thread sync `boundingClientRect`

- Engine exposes a synchronous main-thread reading path for layout rectangle. Currently only `NodesRef.invoke('boundingClientRect')` async via background, or `MainThread.Element.invoke` which is itself wrapped.
- Spec: `function __GetBoundingClientRect(node): { x, y, width, height }`.

#### US-307: Engine PR coordination + version bump

- Open a single tracking issue on `lynx-family/lynx` listing US-301..306, each with a sub-issue.
- Coordinate with engine team to land in one minor version bump (e.g. Lynx 3.8 → 3.9). Shim's package.json then pins `peerDependencies: { '@lynx-js/lynx': '^3.9.0' }` once available.

### Phase 3 Exit Criteria

- All 6 PAPI primitives merged into engine main branch.
- A new Lynx SDK release contains them.
- Shim's TS types reflect the new primitives via updated `@lynx-js/type-element-api` package.

### Phase 3 Open Decisions

- **OQ-3.1 (new):** Deprecation path for old `__XXX` PAPI names that the Shim no longer needs. Engine team owns. Likely: keep both for one major version, deprecation warning starting in that release.
- **OQ-3.2 (new):** Whether main-thread sync `boundingClientRect` should reflow layout if dirty (browser semantics) or return stale-but-cheap (cross-thread coordination cost). Engine team owns.

---

## Phase 4 — Shim Implementation by Tier

**Goal:** Build the production-quality `@lynx-js/dom-shim` package, tier by tier, with progressive exit criteria proving each tier carries its weight.

**Trigger to start:** Phase 2 complete; Phase 3 in progress (L1 can start immediately, L2+ waits for Phase 3 primitives to land).

**Estimated duration:** ~6-10 weeks calendar (overlap-aware), ~2 months of engineering.

### L1 — ReadOnlyNode / ReadOnlyElement (Stories US-401, US-402)

**Trigger:** Phase 2 complete. Does NOT block on Phase 3 because reads use existing PAPI.

**Estimated duration:** 1-2 weeks.

#### US-401: ReadOnlyNode traversal surface

- Implement `parentNode`, `parentElement`, `childNodes`, `children`, `firstChild`, `lastChild`, `nextSibling`, `previousSibling` (using O(n) parent-walk until Phase 3 US-301 lands, then switch).
- Implement `nodeType`, `nodeName`, `tagName`, `isSameNode`, `contains`, `getRootNode`, `compareDocumentPosition`, `isConnected`.

#### US-402: ReadOnlyElement attribute + measurement surface

- Implement `id`, `className`, `classList` (read), `dataset` (read), `attributes`.
- Implement `getAttribute`, `getAttributeNames`, `hasAttribute`.
- Implement `getBoundingClientRect`, `getClientRects` (sync if Phase 3 US-306 ready, async otherwise — choose one based on threading decision OQ-2.1).
- Implement `querySelector`, `querySelectorAll`.

**L1 Exit Criteria:**

- 100% TS type-safe against the Phase 2 interface hierarchy.
- `react-virtual` or equivalent read-only-DOM web library imports and runs without error against the Shim.
- WPT `dom/nodes` ReadOnly subset passes ≥95%.

### L2 — SafeWritableElement (Stories US-403, US-404)

**Trigger:** Phase 3 US-302, US-303, US-305 landed in engine main.

**Estimated duration:** 2-3 weeks.

#### US-403: Attribute / class / dataset / style writes

- `id` setter, `className` setter.
- `classList.add`, `classList.remove`, `classList.toggle` (atomic, leveraging Phase 3 `__RemoveClass`).
- `dataset.x = v` setter via Proxy.
- `setAttribute`, `removeAttribute`.
- `style.X = v` single-property atomic write.

#### US-404: Tree mutation surface

- `appendChild`, `removeChild`, `insertBefore`, `replaceChild`, `cloneNode`.
- Each must be atomic + flush-aware per OQ-2 resolution.

**L2 Exit Criteria:**

- Vanilla TodoMVC runs against the Shim unchanged.
- WPT `dom/lists` subset passes ≥85%.

### L3 — SafeWriteOnlyElement (events) + UnsafeWritableElement (Stories US-405, US-406)

**Trigger:** L2 exit met; HTML parser choice (OQ-3) resolved.

**Estimated duration:** 3-4 weeks.

#### US-405: Event listener facade

- `addEventListener` mints sticky handler name, registers via `__AddEvent`, stores closure on the Shim element record.
- `removeEventListener` finds by `(node, type, fn)` and calls Phase 3 `__RemoveEvent`.
- Capture / bubble phase handled via Lynx `bindEvent` / `capture-bindEvent` / `catchEvent` mapping.
- Cross-thread closure: if Phase 2 OQ-2.1 resolved to dual-thread, document that handler closures must be `'background only'` or `'main thread'` directives.

#### US-406: innerHTML / outerHTML / insertAdjacentHTML

- Bundle the HTML parser chosen in OQ-3.
- `innerHTML` setter: parse → walk → emit `__CreateXxx` / `__SetAttribute` / `__AppendElement` calls.
- `innerHTML` getter: serialize via Phase 2-defined traversal.
- `outerHTML`, `insertAdjacentHTML` similar.
- Document the inline-script policy (OQ-7 from Phase 1 PRD): silently drop, throw, or sandboxed exec. Recommend silently drop with a one-time dev-mode warn.

**L3 Exit Criteria:**

- ≥70% of a scraped corpus of v0.dev / Bolt / Claude Artifacts samples render correctly via the Shim.
- WPT `html/dom` innerHTML subset passes ≥70%.

### L4 — Unsupported (Story US-407)

**Trigger:** L3 exit met.

**Estimated duration:** 1 week.

#### US-407: Unsupported throw paths

- `attachShadow`, `customElements.define`, `document.cookie`, `localStorage`, `location`, `history`, full CSSOM, MutationObserver, etc. all throw `DOMShimUnsupportedError` per Phase 2 US-206 diagnostic shape.
- The error includes a suggested alternative (e.g. attachShadow → "Shadow DOM is not supported on Lynx; use scoped CSS via class prefix instead").

**L4 Exit Criteria:**

- All Phase 2 §SPEC/UNSUPPORTED.md entries throw the expected error.
- No accidental "works in dev, silently breaks in prod" surfaces remaining.

### Phase 4 Open Decisions

- **OQ-4.1 (new):** Bundle size target per tier. Roadmap suggestion: L1 ≤5KB gzip, L2 +≤10KB, L3 with parser +≤30KB, L4 +negligible. To be ratified against Phase 1.5 token-cost finding (if Shim's bundle cost on the device dwarfs its prompt-token savings, the value prop weakens).
- **OQ-4.2 (new):** Export surface — named exports vs default vs namespace. Recommend named per monorepo convention.
- **OQ-4.3 (new):** Test framework. Monorepo uses vitest. Use that.

---

## Phase 5 — Conformance + Dashboard

**Goal:** Make the Shim's compatibility claim verifiable and public. Publish a baseline.json + dashboard so external contributors can see what works and what doesn't, similar to Cloudflare workerd's WPT report.

**Trigger to start:** Phase 4 L3 exit met.

**Estimated duration:** 4 weeks.

### Stories

#### US-501: WPT subset cherry-pick

- Author `packages/dom-shim/wpt/SUBSET.md` listing exactly which WPT tests are in scope.
- Categories: `dom/nodes`, `dom/events`, `dom/lists`, `dom/traversal`, `html/dom` (innerHTML), `css/cssom` (computed style only), `selectors`.
- Excluded: Shadow DOM, iframe, full CSSOM, Range/Selection. Each exclusion has a one-line rationale.

#### US-502: WPT runner harness

- Adapt the upstream WPT runner to drive the Shim instead of a browser.
- Output: per-test pass/fail records in WPT's standard JSON shape.

#### US-503..506: Conformance pass thresholds

- US-503: `dom/nodes` ≥95% pass.
- US-504: `dom/events` ≥90% pass.
- US-505: `dom/lists` ≥85% pass.
- US-506: `html/dom` (innerHTML subset) ≥70% pass.
- Each story commits the actual pass-rate to a versioned `wpt-baseline.json`.

#### US-507: 100-prompt LLM agent-loop benchmark

- Reuse Phase 1 benchmark infra but with the real Shim instead of mock. Scale corpus from 50 to 100 prompts (add more complex / multi-page scenarios).
- Run with N=3 self-repair; produce the "production-class" version of the Phase 1 recommendation document.

#### US-508: baseline.json + dashboard publication

- Publish a GitHub Pages-style dashboard at `lynx-shim-conformance.lynxjs.org` (or similar) showing:
  - Per-category WPT pass rate
  - Token-cost-per-render-correct delta vs raw PAPI
  - LLM agent-loop convergence over time (regression tracking)
- Update on every CI run via GH Actions.

### Phase 5 Exit Criteria

- `wpt-baseline.json` committed.
- Dashboard live and updates on PR.
- 100-prompt agent-loop benchmark complete; results in the dashboard.
- A "Compatibility" section added to the public Lynx docs (`docs/dom-shim/compatibility.md`).

### Phase 5 Open Decisions

- **OQ-5.1 (new):** Hosting. Lynx public docs are at `lynxjs.org`; the dashboard should live there or under it. Coordinate with docs team.
- **OQ-5.2 (new):** Whether to publish Shim's nightly WPT pass rate as a public CI badge in the README. Recommend yes — external contributors can see regressions immediately.

---

## Cross-Cutting Concerns

### Versioning

- Shim package version follows semver. Pre-1.0 (Phase 1-4): `0.x.y` where every minor bump can be breaking.
- 1.0 ships with Phase 5 dashboard. Beyond 1.0, breaking changes follow Lynx engine major version cadence.

### Compatibility with the parallel `Huxpro/lynx-dom-shim` testing-environment work

The parallel branch already shipped 10 stories of a testing-environment-focused Shim under `packages/testing-library/testing-environment/src/dom-shim/`. That work targets `jest-dom`-style assertions, not LLM-output runtime. Phase 2 US-205 should explicitly decide whether:

- (a) The two Shims share the same Phase 2 tier interfaces (compile-time check) but ship as two packages.
- (b) The Shims fully merge into one package with a `testing` and a `runtime` export surface.
- (c) They stay distinct, with no shared types.

Recommendation: (a) — shared interfaces, separate packages. Lets each team ship at its own velocity while preventing semantic drift.

### Engine coordination

Phase 3 is the only cross-team dependency. To de-risk:

- Open the tracking issue on `lynx-family/lynx` at the **start** of Phase 2, not at the start of Phase 3. Gives engine team time to estimate.
- Phase 4 L1 work proceeds in parallel — by the time L2 is unblocked, Phase 3 should be close to landing.

### Kill criteria

This roadmap dies if any of the following:

1. **Phase 1.5 RECOMMENDATION.md verdict = NO-GO.** Then Phase 2-5 collapses to a one-week effort: write RFC closure and ship Phase 1 data.
2. **Phase 3 engine team velocity < 1 PAPI primitive per month.** Then L2-L4 stalls and Shim ships at L1-only, which significantly weakens the value prop. Re-scope decision required.
3. **Phase 4 L3 fails the v0/Artifacts ≥70% gate.** Then innerHTML approach was wrong; revisit OQ-3 parser choice or revisit whether to support innerHTML at all.
4. **Phase 5 dashboard shows < 80% combined WPT pass rate after 1 month.** Conformance bar was set too high or Shim has architectural problems; bring to architectural review.

---

## When to write the full PRD for each phase

| Phase      | Trigger to write detailed PRD                                             |
| ---------- | ------------------------------------------------------------------------- |
| Phase 2    | Phase 1.5 RECOMMENDATION.md committed                                     |
| Phase 3    | Phase 2 SPEC/THREADING.md + SPEC/FLUSH.md + SPEC/HTML_PARSER.md committed |
| Phase 4 L1 | Phase 2 US-205 (TS hierarchy) committed                                   |
| Phase 4 L2 | Phase 3 US-302/303/305 merged in engine                                   |
| Phase 4 L3 | Phase 4 L2 exit met (TodoMVC runs)                                        |
| Phase 4 L4 | Phase 4 L3 exit met                                                       |
| Phase 5    | Phase 4 L3 exit met                                                       |

This is deliberate. Writing a phase's PRD _after_ its predecessor produces data avoids the "Phase 2 design decision was based on Phase 1.5 vibes" failure mode. Each PRD is then ~1 day of focused writing with the data in hand.

---

## Total estimate

Optimistic: 3 months calendar, 2 months engineering, 1 engineer + engine team coordination.

Realistic: 5 months calendar, 3 months engineering, 1 engineer + engine team coordination + 1 designer for diagnostic UX + 1 docs writer for Phase 5.

Pessimistic (Phase 3 stalls, Phase 4 L3 misses gate once): 8 months calendar.

---

## Summary table

| Phase       | Goal                         | Trigger                  | Duration       | LLM/Infra cost               |
| ----------- | ---------------------------- | ------------------------ | -------------- | ---------------------------- |
| 1 ✅        | Benchmark infra + first data | Initial                  | ~1 week        | $0                           |
| 1.5 (PRD'd) | Decision-grade data          | Phase 1 commit           | ~5h work + $50 | ~$50                         |
| 2           | Tier spec + RFC reply        | Phase 1.5 RECOMMENDATION | 1-2 weeks      | $0                           |
| 3           | Engine PAPI gaps             | Phase 2 US-205           | 4-8 weeks      | $0 (engine team work)        |
| 4 L1        | ReadOnly impl                | Phase 2 done             | 1-2 weeks      | $0                           |
| 4 L2        | SafeWrite impl + TodoMVC     | Phase 3 partial          | 2-3 weeks      | $0                           |
| 4 L3        | UnsafeWrite + parser         | L2 done                  | 3-4 weeks      | $0                           |
| 4 L4        | Unsupported throws           | L3 done                  | 1 week         | $0                           |
| 5           | Conformance + dashboard      | L3 done                  | 4 weeks        | ~$100 (100-prompt benchmark) |

**Total LLM cost across all phases: ~$150.**
