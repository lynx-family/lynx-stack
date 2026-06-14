# PRD: Lynx DOM Shim Implementation (M1–M7)

> **Status:** Active. This PRD drives a multi-session Ralph autonomous loop.
> **Branch:** `Huxpro/lynx-dom-shim-benchmark` in worktree `/Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark`.
> **Companion docs (authoritative):**
>
> - [`Shim_Design.md`](Shim_Design.md) — 975-line spec; AC of every story below cites a §-section.
> - [`PRD.md`](PRD.md) — Phase 1 benchmark (done).
> - [`Phase_1_5_PRD.md`](Phase_1_5_PRD.md) — token-cost + real Lynx mock (in-flight in parallel session).
> - [`Phase_2_to_5_Roadmap.md`](Phase_2_to_5_Roadmap.md) — multi-phase roadmap; this PRD subsumes its Phase 4.
> - [`REPORT.md`](REPORT.md) — Phase 1 program report.

---

## 1. Introduction

The Lynx DOM Shim is a TypeScript package — `@lynx-js/dom-shim` — that lets LLM-emitted code and standard JS web libraries execute against Lynx's Element PAPI **without writing private `__XXX` PAPI calls**. It is a **tiered runtime DOM emulation layer**: L1 ReadOnly → L2 SafeWrite → L3a Events → L3b UnsafeWrite → L4 throws.

This PRD specifies the implementation of M1–M7 (the full vertical stack: source tree, scheduler, write-through cache, event multiplex, innerHTML parser, L4 throw paths, and the WPT conformance runner that verifies all of the above).

**Why this PRD exists:** `Shim_Design.md` gives the _what_ and _how_. This PRD gives the _order_, _acceptance criteria_, _Ralph completion gate_, and the per-story decomposition needed for an autonomous agent to make incremental, verifiable progress.

---

## 2. Goals (measurable)

- **G1:** `@lynx-js/dom-shim` exposes a class hierarchy `L1ReadOnlyNode → L1ReadOnlyElement → L2SafeWritableElement → L3aEventfulElement → L3bUnsafeWritableElement`. Compile-time tier narrowing works via runtime cast helpers.
- **G2:** A static TodoMVC vanilla-JS sample runs against the Shim unmodified (end of M3 exit gate, validated end of M4).
- **G3:** A scraped corpus of v0.dev / Bolt / Claude Artifacts sample outputs (≥30 samples) renders correctly via L3b innerHTML pipeline (end of M5 exit gate).
- **G4:** Every L4-unsupported surface throws `DOMShimUnsupportedError` with structured `{ code, tier, surface, position, suggestion }` (end of M6).
- **G5:** Cherry-picked WPT subset (Shim_Design §11) achieves **≥70% pass rate** in CI (end of M7, **Ralph completion gate**).
- **G6:** API surface coverage equals or exceeds React Native's [Nodes API](https://reactnative.dev/docs/nodes) — measured by checking that every property/method on RN's `ReadOnlyNode`, `ReadOnlyElement`, and `ReactNativeElement` has a Shim equivalent at L1 or L2.
- **G7:** Public dashboard at a TBD URL renders the live WPT pass-rate from `baseline.json`, broken down by directory.

---

## 3. Architecture pointer

**Read `Shim_Design.md` before writing any story.** It is the spec. This PRD does not re-derive semantics; it sequences them.

Quick map from this PRD's story IDs to Shim_Design sections:

| Story range    | Implements Shim_Design §                                            |
| -------------- | ------------------------------------------------------------------- |
| US-401..US-410 | §4 (Tier 1 — ReadOnly)                                              |
| US-411..US-420 | §5 (Tier 2 — SafeWritable, attribute/class/style/dataset surface)   |
| US-421..US-426 | §5.2.6 (tree mutation), §9.1 (DocumentFragment), §5.2.7 (cloneNode) |
| US-431..US-435 | §6 (Tier 3a — Events)                                               |
| US-441..US-450 | §7 (Tier 3b — UnsafeWritable, innerHTML and friends)                |
| US-451..US-455 | §8 (Tier 4 — Unsupported throws)                                    |
| US-461..US-470 | §11 (Conformance Goals), Phase_2_to_5_Roadmap §Phase 5              |
| US-471         | §5.3 (auto-flush at microtask boundary)                             |
| US-472         | §3.2 + §5.2.5 (write-through cache strategy)                        |
| US-473         | §7.4 (HTML→Lynx tag map)                                            |
| US-474         | Appendix A (diagnostic format)                                      |
| US-475         | §2 "Tier selection"                                                 |

---

## 4. Milestones (high-level)

| Milestone                   | Stories                          | Estimated effort | Exit gate                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 L1 ReadOnly**          | US-401..US-410                   | ~1 wk            | Read-only sample using `__GetPageElement` + Shim wrappers runs against real Lynx mock (Phase 1.5 US-153) and returns correct values for all L1 getters. Unit tests in `packages/dom-shim/src/runtime/__tests__/L1.test.ts` pass. |
| **M2 L2 SafeWrite (props)** | US-411..US-420 + US-471 + US-472 | ~1.5 wk          | `setAttribute` + `classList.add` + `style.color = 'red'` work on real Lynx mock; **read-after-write consistent** within same microtask.                                                                                          |
| **M3 L2 SafeWrite (tree)**  | US-421..US-426 + US-475          | ~1 wk            | `appendChild`/`cloneNode(true)` work; DocumentFragment flattens; **vanilla TodoMVC test renders without runtime errors** (TodoMVC's clear-completed exercises tree mutation, classList, and event handlers — last requires M4).  |
| **M4 L3a Events**           | US-431..US-435                   | ~1.5 wk          | Multiple handlers fire in registration order; `once: true` removes after one fire; `signal` aborts; **vanilla TodoMVC runs end-to-end including click handlers**.                                                                |
| **M5 L3b UnsafeWrite**      | US-441..US-450 + US-473 + US-474 | ~2 wk            | `el.innerHTML = '<div class="x">hi</div>'; el.querySelector('.x')` returns the child; ≥30 v0.dev/Bolt/Artifacts samples render correctly.                                                                                        |
| **M6 L4 Unsupported**       | US-451..US-455                   | ~3 d             | All §8 surfaces throw `DOMShimUnsupportedError` with expected `code`; agent-loop harness can detect, repair, and retry on the structured error.                                                                                  |
| **M7 WPT Conformance**      | US-461..US-470                   | ~1 wk            | WPT subset achieves ≥70% pass rate in CI; dashboard live; Ralph completion gate met.                                                                                                                                             |

**Total:** ~9 weeks engineering for a single engineer. Ralph is the engineer here; multi-session is expected.

---

## 5. User Stories

Each story:

- Names the Shim_Design § it implements.
- Has AC ending in `Typecheck + lint pass` and `Unit tests added in`packages/dom-shim/src/runtime/**tests**/<file>.test.ts``.
- For L2+ stories: include the "verified against real-Lynx mock if available, otherwise stub mock" criterion.
- For stories landing after US-461: include "WPT subset pass rate does not regress in CI."

Stories are ordered roughly in implementation order; explicit dependencies are in §11.

---

### Milestone 1 — L1 ReadOnly

#### US-401: Skeleton classes and package bootstrap

**Description:** As the Ralph implementor, I need the runtime source tree, base class file, and tsconfig in place so subsequent stories have somewhere to land.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] Create `packages/dom-shim/src/runtime/` directory.
- [ ] `packages/dom-shim/src/runtime/index.ts` exports `L1ReadOnlyNode`, `L1ReadOnlyElement`, `L1ReadOnlyText`, `document`, `wrapPapi(ref)`. All but the abstract base are placeholder classes with `// TODO US-4XX` markers.
- [ ] `packages/dom-shim/package.json` exposes `"exports": { ".": "./src/index.ts", "./runtime": "./src/runtime/index.ts", "./tiers": "./src/runtime/tiers.ts" }`. Update `scripts`: add `"test:runtime": "vitest run packages/dom-shim/src/runtime"`.
- [ ] Add `vitest` to devDependencies if not present.
- [ ] `packages/dom-shim/src/runtime/wrap.ts`: `wrapPapi(ref: ElementRef): L1ReadOnlyNode` returns the right tier subclass based on tag (text-tag → `L1ReadOnlyText`; everything else → highest available tier installed at that point — initially `L1ReadOnlyElement`, later `L3bUnsafeWritableElement` as classes ship).
- [ ] Add `papi` shadow types from `@lynx-js/type-element-api` as a `type` import; runtime depends on global `__XXX` functions being present.
- [ ] Test stub in `__tests__/bootstrap.test.ts` instantiating each class with a stub `ElementRef`.
- [ ] Typecheck + lint pass.

#### US-402: L1ReadOnlyNode — identity & tree traversal (sync paths)

**Description:** Implement the cheap traversal methods on `L1ReadOnlyNode`. Cite Shim_Design §4.1, §4.2.1.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `nodeType`, `nodeName`, `nodeValue` per §4.1.
- [ ] `parentNode`, `parentElement`, `firstChild`, `lastChild`, `nextSibling`, `childNodes` per §4.2.1.
- [ ] `hasChildNodes()`, `isConnected`, `getRootNode()`, `contains()`, `compareDocumentPosition()`, `isEqualNode()`, `isSameNode()`.
- [ ] `parentNode` returns `null` when `__GetParent` returns falsy OR equals `__GetPageElement()`'s sentinel (see §4.2.1 footnote).
- [ ] `childNodes` returns a frozen array wrapped as `NodeList` (snapshot — divergence documented).
- [ ] Unit tests in `__tests__/L1-traversal.test.ts`: a 3-level tree, every getter returns expected values.
- [ ] Verified against real-Lynx mock if available, otherwise stub-mock.
- [ ] Typecheck + lint pass.

#### US-403: L1ReadOnlyNode — previousSibling via O(n) walk

**Description:** Implement `previousSibling` (no `__PrevElement` PAPI). Cite Shim_Design §3.2, §4.2.1.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `previousSibling` walks `__GetChildren(parent)` and uses `__ElementIsEqual` to find self index, returns `children[i-1]` or `null`.
- [ ] `previousElementSibling` on `L1ReadOnlyElement` skips non-elements.
- [ ] Unit test: 5-sibling tree, every sibling's `previousSibling` returns the correct preceding ref.
- [ ] Performance note added to JSDoc: "O(n) in sibling count."
- [ ] Verified against real-Lynx mock if available, otherwise stub-mock.
- [ ] Typecheck + lint pass.

#### US-404: L1ReadOnlyElement — id, tagName, className, classList getter

**Description:** Identity getters and the readonly portion of classList. Cite Shim_Design §4.1, §4.2.3.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `id` via `__GetID`.
- [ ] `tagName` returns upper-cased HTML tag via the tag map (US-473) — for M1, hardcode a minimal Lynx→HTML reverse map (`view→DIV`, `text→SPAN`, `image→IMG`, `input→INPUT`); the full map lands in US-473.
- [ ] `localName` lowercase.
- [ ] `className` returns `__GetClasses().join(' ')`.
- [ ] `classList` returns a `ReadOnlyDOMTokenList` with `.contains`, `.item`, `.length`, `[Symbol.iterator]` (NOT `.add/.remove/.toggle` — those are L2).
- [ ] Unit tests for each getter.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-405: L1ReadOnlyElement — attribute read surface

**Description:** Implement `getAttribute`, `getAttributeNames`, `hasAttribute`, `hasAttributes`, `attributes` (NamedNodeMap, snapshot). Cite Shim_Design §4.1, §4.2.3.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] All five APIs implemented via `__GetAttributeByName` / `__GetAttributeNames` / `__GetAttributes`.
- [ ] `getAttribute(name)`: PAPI returns `any` → coerce to string via `String(value)` if defined, else `null`.
- [ ] `attributes` returns a snapshot `NamedNodeMap`; attempting to mutate throws (`DOMShimInvariantError`, see US-474).
- [ ] Unit test: set attributes via PAPI directly, verify read-back matches.
- [ ] Typecheck + lint pass.

#### US-406: L1ReadOnlyElement — dataset read

**Description:** Readonly proxy over `__GetDataset`. Cite Shim_Design §4.2.3.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `dataset` returns a `Readonly<Record<string, string>>` proxy that calls `__GetDataset(papi)` on each read.
- [ ] Mutation attempts (set/delete) throw `DOMShimInvariantError` with `code: 'L1/dataset-readonly'`.
- [ ] PAPI `unknown` value coerced via `String()`.
- [ ] Unit test: dataset write via PAPI, dataset read via Shim, equality check.
- [ ] Typecheck + lint pass.

#### US-407: L1ReadOnlyElement — children, firstElementChild, etc.

**Description:** Element-tree traversal (filters non-element children). Cite Shim_Design §4.2.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `children`, `firstElementChild`, `lastElementChild`, `nextElementSibling`, `previousElementSibling`, `childElementCount` per §4.1.
- [ ] Filters L1ReadOnlyText nodes (when present inside `<text>` Lynx elements).
- [ ] Unit test: container with mixed element + raw-text children — `firstChild` returns text, `firstElementChild` skips it.
- [ ] Typecheck + lint pass.

#### US-408: L1ReadOnlyElement — selectors (querySelector, matches, closest)

**Description:** Selector engine bridges. Cite Shim_Design §4.2.4.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `querySelector(s)` → `__QuerySelector(papi, s, { onlyCurrentComponent: false })`.
- [ ] `querySelectorAll(s)` → `__QuerySelectorAll(...)`.
- [ ] `matches(s)` implemented per §4.2.4: O(n) parent-subtree walk.
- [ ] `closest(s)` walks up parents calling `matches`.
- [ ] Performance note in JSDoc for `matches` and `closest`.
- [ ] Unit tests with 5-element tree and 3 distinct selectors.
- [ ] Typecheck + lint pass.

#### US-409: L1ReadOnlyElement — getBoundingClientRect (zero-rect + async fill)

**Description:** Async-cached geometry. Cite Shim_Design §4.2.5, OQ-S.4 (resolved to "zero+async+warn").
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] OQ-S.4 resolution captured at top of file: "First call returns zero rect, schedules `__InvokeUIMethod(papi, 'boundingClientRect', {}, cb)`, caches on callback, subsequent calls return cached value."
- [ ] `WeakMap<ElementRef, DOMRectReadOnly>` cache.
- [ ] First-call `console.warn` once per element with `shim:L1/geometry-cached-stale`.
- [ ] Cache invalidated on any L2+ mutation on `this` element or any ancestor — track via a simple version counter on the page-element root, recomputed lazily.
- [ ] Unit test: first call returns zero rect, second call after mock callback returns the cached non-zero rect.
- [ ] Typecheck + lint pass.

#### US-410: L1ReadOnlyText — text node emulation

**Description:** Raw text emulation for Lynx's text element. Cite Shim_Design §4.1, §4.2.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `L1ReadOnlyText` extends `L1ReadOnlyNode` (NOT `L1ReadOnlyElement`).
- [ ] `nodeType === 3`, `nodeName === '#text'`, `nodeValue` returns the raw text payload.
- [ ] No child traversal (raw-text has no children).
- [ ] `wrapPapi` returns `L1ReadOnlyText` when `__GetTag(ref) === 'raw-text'` (per Lynx convention).
- [ ] Unit test: raw text node has `nodeType=3`, `firstChild=null`.
- [ ] Typecheck + lint pass.

---

### Milestone 2 — L2 SafeWritable (properties)

#### US-411: Auto-flush microtask scheduler (US-471)

**Description:** Cross-cutting scheduler that any L2+ mutation registers with. Cite Shim_Design §5.3, OQ-S.1 resolution (auto-microtask).
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/src/runtime/scheduler.ts` exposes `scheduleFlush(): void` and `flush(): void` (synchronous).
- [ ] `scheduleFlush` does a `queueMicrotask(() => __FlushElementTree())` exactly once per microtask boundary; idempotent.
- [ ] Exposes `setAutoFlush(enabled: boolean): void`; when disabled, `scheduleFlush` is a no-op and caller must call `flush()` manually.
- [ ] Unit test: 3 mutations in same JS frame → exactly one `__FlushElementTree` call after `await new Promise(r => queueMicrotask(r))`.
- [ ] Typecheck + lint pass.

#### US-412: Write-through cache infrastructure (US-472)

**Description:** Per-element cache for attribute, classList, style, dataset reads. Cite Shim_Design §3.2 + §5.2.5.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/src/runtime/cache.ts` exposes `getElementCache(ref): ElementCache` returning a per-`ElementRef` record with `{ attrs: Map<string, string>, classes: string[] | null, styles: Map<string, string>, dataset: Record<string, string>, classesLazy: boolean, ... }`.
- [ ] `WeakMap<ElementRef, ElementCache>` storage.
- [ ] `classes` is `null` until first read (lazy init from `__GetClasses`), then mutates in lockstep with Shim writes.
- [ ] `invalidate(ref, key)` for selective invalidation; full invalidation on `cloneNode` etc.
- [ ] Unit test: writes via cache helpers reflect on subsequent reads without PAPI roundtrip.
- [ ] Typecheck + lint pass.

#### US-413: L2SafeWritableElement — setAttribute / removeAttribute / toggleAttribute

**Description:** Attribute mutation. Cite Shim_Design §5.2.3.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `setAttribute(name, value)` calls `__SetAttribute(papi, name, String(value))` and updates cache.
- [ ] `removeAttribute(name)` calls `__SetAttribute(papi, name, undefined)` and deletes from cache. Divergence `shim:L2/attribute-removal-jsside-only` documented in JSDoc.
- [ ] `toggleAttribute(name, force?)` composes the two.
- [ ] `getAttribute` (inherited from L1) is cache-aware on L2+ instances.
- [ ] Auto-flush triggered (US-411).
- [ ] Unit test: round-trip `setAttribute('x', '1')` → `getAttribute('x') === '1'` synchronously.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-414: L2SafeWritableElement — id, className setters

**Description:** Identity write. Cite Shim_Design §5.2.1.
**Estimate:** 0.25 d
**Acceptance Criteria:**

- [ ] `set id(v)` → `__SetID(papi, v)` + cache.
- [ ] `set className(v)` → `__SetClasses(papi, v)` + cache classes array (split by `/\s+/`, filter empty).
- [ ] Auto-flush.
- [ ] Unit test: round-trip.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-415: L2DOMTokenList — classList add/remove/toggle/replace/contains

**Description:** Full classList API. Cite Shim_Design §5.2.2.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `add(...names)` calls `__AddClass(papi, name)` for each and updates cache (de-duped).
- [ ] `remove(...names)` rebuilds via `__SetClasses(papi, filtered.join(' '))`. Divergence `shim:L2/classlist-jsside-cache` in JSDoc.
- [ ] `toggle(name, force?)` returns post-state boolean per spec.
- [ ] `replace(oldName, newName)` returns boolean per spec (false if old absent).
- [ ] `contains(name)` reads cache (O(1) after warm).
- [ ] `[Symbol.iterator]`, `item(i)`, `length`, `value` getter.
- [ ] `refresh()` Shim-only method to re-read from PAPI.
- [ ] Unit tests for each method including spec edge: `add('a a')` throws `InvalidCharacterError` per spec.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-416: L2 dataset write proxy

**Description:** `el.dataset.foo = 'bar'` round-trip. Cite Shim_Design §5.2.4.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] Proxy-based writable dataset: assignment → `__AddDataset(papi, k, v)` + cache; deletion → cache delete + `__SetDataset(papi, rebuiltCache)`.
- [ ] Read returns cache if present else `__GetDataByKey`.
- [ ] Coerces value via `String()` per HTML spec.
- [ ] Auto-flush.
- [ ] Unit test: set, read, delete, read returns undefined.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-417: L2CSSStyleDeclaration — setProperty / getPropertyValue / removeProperty

**Description:** Inline style API with write-through cache. Cite Shim_Design §5.2.5.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `setProperty(name, value, priority?)` calls `__AddInlineStyle(papi, kebabName, value)` + cache.
- [ ] `getPropertyValue(name)` reads cache only (engine has no readback path with string key — divergence `shim:L2/style-jsside-cache-authoritative` in JSDoc).
- [ ] `removeProperty(name)` calls `__AddInlineStyle(papi, kebabName, undefined)` + cache delete; returns previous value per spec.
- [ ] `priority` argument stored in a parallel Map per OQ-S.3 default ("cache-only, NOT propagated to PAPI — divergence `shim:L2/no-important-propagation`"); document the OQ-S.3 resolution at top of file.
- [ ] `item(i)`, `length`, `[Symbol.iterator]`, `cssText` getter (joins cache as canonical text).
- [ ] Auto-flush.
- [ ] Unit tests: round-trip, kebab-case ↔ camelCase conversion, removeProperty returns prev value, empty string when not set.
- [ ] Verified against real-Lynx mock if available.
- [ ] Typecheck + lint pass.

#### US-418: L2CSSStyleDeclaration — camelCase property accessors

**Description:** `el.style.backgroundColor = 'red'` shortcut. Cite Shim_Design §5.2.5.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] Proxy or `defineProperty`-based: any camelCase name maps to `setProperty(kebab-case, value)` and `getPropertyValue(kebab-case)`.
- [ ] Static list of known CSS properties from `csstype` or similar baked into the type definition so `el.style.color = ...` is typechecked.
- [ ] Unknown property names accepted at runtime (HTML allows arbitrary CSS custom props like `--x`).
- [ ] Unit tests: camelCase → kebab-case round-trip.
- [ ] Typecheck + lint pass.

#### US-419: Cache invalidation on tier-narrowed views

**Description:** When `ReadOnly(el)` or `SafeWrite(el)` is called (US-475), the cache must remain shared with the underlying ref. Cite Shim_Design §2 "Tier selection."
**Estimate:** 0.25 d
**Acceptance Criteria:**

- [ ] Narrowed view shares the same `ElementRef` + cache as the wide view.
- [ ] Mutations through wide view are immediately visible through narrowed view's L1 getters.
- [ ] Unit test: mutate via L2 wrapper, read via L1 wrapper, value matches.
- [ ] Typecheck + lint pass.

#### US-420: L2 M2 exit integration test

**Description:** End-to-end test that covers all L2 property mutations against a real-Lynx mock. Cite Shim_Design §5.3, §5.4.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `__tests__/M2-exit.test.ts`: 5-element tree, applies setAttribute + classList + style + dataset mutations, asserts all read paths consistent.
- [ ] Test passes against real-Lynx mock (from Phase 1.5 US-153) if available; else stub mock.
- [ ] No console.warn except the documented L1 geometry one.
- [ ] Auto-flush actually called exactly once at microtask boundary.
- [ ] Typecheck + lint pass.

---

### Milestone 3 — L2 SafeWritable (tree)

#### US-421: appendChild, insertBefore, removeChild, replaceChild

**Description:** The four canonical mutation primitives. Cite Shim_Design §5.2.6.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `appendChild` removes child from its current parent first (per spec), then `__AppendElement(this, child)`. Returns child.
- [ ] `insertBefore(newNode, refNode)` handles `refNode === null` (becomes appendChild). Calls `__InsertElementBefore`.
- [ ] `removeChild(child)`: if `child.parentNode !== this`, throw `DOMShimInvariantError({ code: 'NotFoundError' })`. Else `__RemoveElement(this, child)`.
- [ ] `replaceChild(newChild, oldChild)`: throw if `oldChild.parentNode !== this`. Calls `__ReplaceElement(newChild, oldChild)`.
- [ ] Auto-flush.
- [ ] Cache invalidation: drop `boundingClientRect` cache on `this` and the moved/removed subtree.
- [ ] Unit tests for each, plus tree-integrity invariant after each op.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-422: append, prepend, before, after, replaceWith, remove

**Description:** Convenience tree-op shortcuts. Cite Shim_Design §5.1.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `append(...nodes)`, `prepend(...nodes)` accept string OR node; strings become raw-text nodes via `__CreateRawText`.
- [ ] `before(...)`, `after(...)`, `replaceWith(...)` operate via parent.
- [ ] `remove()` removes self from parent; no-op if detached.
- [ ] Unit tests covering mixed string/node arg.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-423: cloneNode (shallow + deep)

**Description:** Element cloning. Cite Shim_Design §5.2.7.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `cloneNode(deep?)` calls `__CloneElement(papi, { deep })`.
- [ ] Wraps result with `wrapPapi` to return matching tier.
- [ ] Cache for cloned node is fresh (NOT shared with original).
- [ ] Unit test: deep clone of 3-level tree, all children present in clone.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-424: DocumentFragment (US-S.5 resolution)

**Description:** Detached subtree holder. Cite Shim_Design §9.1, OQ-S.5.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] OQ-S.5 resolution captured at top of file: "DocumentFragment maps to `__CreateWrapperElement(parentComponentUniId)`. Spec requires flatten on append — we verify wrapper flattens; if not, implement JS-side flatten in `appendChild` when child is a fragment."
- [ ] `document.createDocumentFragment()` returns `ShimDocumentFragment`.
- [ ] Fragment supports `appendChild`, `removeChild`, `firstChild`, `childNodes`.
- [ ] Appending a fragment to a real parent transfers all fragment children and empties the fragment (per spec).
- [ ] Unit tests: build fragment with 3 children, append to body, fragment has 0 children, body has 3.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-425: document.createElement and the page root

**Description:** Wire `document.createElement(tag)` to PAPI Create functions. Cite Shim_Design §9, §7.4 (tag map).
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `document.createElement(tag)` looks up tag map (US-473): `div→__CreateView`, `text/span→__CreateText`, `img→__CreateImage`, etc.
- [ ] Returns L3b-tier instance by default (most-capable; tier narrowing via US-475).
- [ ] Permissive fallback (OQ-S.2 resolution): unmapped tag → `__CreateView` + `__SetAttribute(papi, 'data-shim-tag', tag)`.
- [ ] `document.createTextNode(text)` returns `L1ReadOnlyText` wrapping `__CreateRawText`.
- [ ] `document.documentElement` returns `__GetPageElement()` wrapped.
- [ ] `document.body` resolves per OQ-S.7: pin via `setBody(ref)` Shim init option; default: first child of page if present, else page itself; document choice with `console.info` once.
- [ ] Unit test: `document.createElement('div')` returns L3b; tag map covers div/span/p/img/input/button; unmapped tag gets data-shim-tag.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-426: M3 exit integration test — TodoMVC structural skeleton

**Description:** Build the static DOM tree of TodoMVC's index.html via Shim API; assert correct structure.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `__tests__/M3-todomvc-static.test.ts` builds: header, input, ul.todo-list, footer. Adds 3 hard-coded todo items via `document.createElement` + `appendChild`.
- [ ] Queries the resulting tree via `document.querySelectorAll('.todo-list li')` — returns 3 elements.
- [ ] `el.classList.contains('completed')` works for each item.
- [ ] No L4 throws during the test.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

---

### Milestone 4 — L3a Events

#### US-431: Event base classes — ShimEvent + EventTarget

**Description:** Spec-shaped `Event` class for synthetic dispatch. Cite Shim_Design §6.2.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/src/runtime/events.ts` defines `ShimEvent` with `type`, `target`, `currentTarget`, `bubbles`, `cancelable`, `defaultPrevented`, `eventPhase`, `timeStamp`.
- [ ] `preventDefault()`, `stopPropagation()`, `stopImmediatePropagation()`.
- [ ] `composedPath()` returns array (empty if not in tree).
- [ ] Sub-types: `ShimMouseEvent`, `ShimKeyboardEvent` constructed from Lynx event payload (mapping per §6.3 `shim:L3a/event-payload-mapping`).
- [ ] Unit tests for each event method.
- [ ] Typecheck + lint pass.

#### US-432: L3aEventfulElement — addEventListener with multiplex

**Description:** Multi-handler-per-type via shim trampoline. Cite Shim_Design §6.2.
**Estimate:** 1.5 d
**Acceptance Criteria:**

- [ ] Per-`ElementRef` `Map<EventType, Set<HandlerRecord>>` storage.
- [ ] First listener on (papi, type) registers trampoline via `__AddEvent(papi, type, '__shim_trampoline__' + type, trampolineFn)`.
- [ ] Subsequent listeners add to Set only (one PAPI slot).
- [ ] HandlerRecord stores `{ fn, capture, once, passive, signal }`.
- [ ] Spec dedupe: same (type, fn, capture) is a no-op.
- [ ] `signal` (AbortSignal) hooks: on abort, remove listener.
- [ ] Unit tests: 3 handlers on click, fire event → all 3 fire in registration order; same (fn, capture) added twice → only one record.
- [ ] Typecheck + lint pass.

#### US-433: removeEventListener and once option

**Description:** Removal + auto-removal. Cite Shim_Design §6.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `removeEventListener(type, handler, options)` finds and removes (type, fn, capture) from Set.
- [ ] `once: true` listener is auto-removed after first fire.
- [ ] If Set becomes empty, optionally `__AddEvent(papi, type, name, undefined)` to clear engine slot (optimization).
- [ ] Unit tests: register + remove + dispatch → handler doesn't fire; once: dispatch twice → handler fires once.
- [ ] Typecheck + lint pass.

#### US-434: Synthetic capture + bubble phase dispatch

**Description:** Walk from page-root to target for capture, target itself, then up for bubble. Cite Shim_Design §6.2, §6.3 `shim:L3a/capture-synthetic`.
**Estimate:** 1.5 d
**Acceptance Criteria:**

- [ ] Trampoline at target: build ancestor chain via `__GetParent` to page root.
- [ ] Fire capture listeners top-down.
- [ ] Fire target listeners (capture: false first, then capture: true at target per spec).
- [ ] Fire bubble listeners bottom-up (capture: false only) if `event.bubbles && !event._propagationStopped`.
- [ ] `stopPropagation` halts after current target; `stopImmediatePropagation` halts within current target's listener set.
- [ ] `passive: true` ignores `preventDefault()` calls (matches spec).
- [ ] Unit test: 3-level tree, capture handlers + bubble handlers, assert firing order.
- [ ] Typecheck + lint pass.

#### US-435: dispatchEvent → L4 throw + M4 exit integration test

**Description:** Synthetic dispatch is L4 in v0; full TodoMVC integration test exercising click events. Cite Shim_Design §6.1, §8.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `dispatchEvent(event)` throws `DOMShimUnsupportedError` with `code: 'L4/synthetic-dispatch'` (US-474).
- [ ] `__tests__/M4-todomvc-events.test.ts` builds TodoMVC tree (from M3 test), wires click handlers for "add todo", "toggle done", "clear completed". Simulates click via direct trampoline invocation (NOT dispatchEvent). All handlers fire in correct order; UI state reflects updates.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

---

### Milestone 5 — L3b UnsafeWritable

#### US-441: HTML→Lynx tag map definitive (US-473)

**Description:** The complete versioned tag table. Cite Shim_Design §7.4.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/SPEC/TAG_MAP.json` ships with the full Shim_Design §7.4 table.
- [ ] `packages/dom-shim/src/runtime/tag-map.ts` loads it; exports `htmlToLynx(tag: string): { lynxTag: string; defaultClasses: string[] }` and `lynxToHtml(tag: string): string`.
- [ ] OQ-S.8 resolution at top of file: tag-map version pinned to package SemVer; breaking changes = major bump.
- [ ] OQ-S.2 resolution recap: permissive fallback (`view` + `data-shim-tag="X"`).
- [ ] Unit tests: every entry in TAG_MAP.json round-trips html→lynx→html.
- [ ] Typecheck + lint pass.

#### US-442: DOMShim error hierarchy (US-474)

**Description:** Three structured error classes consumed by LLM agent loop. Cite Shim_Design Appendix A.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `DOMShimUnsupportedError` (L4), `DOMShimInvariantError` (e.g. removeChild of non-child), `DOMShimDivergenceWarning` (logged not thrown).
- [ ] All carry `{ code, tier, surface, position, message, suggestion, elementUid, elementTag }`.
- [ ] `position` filled best-effort via `Error.captureStackTrace` and stack parser.
- [ ] `toJSON()` returns the structured shape from Appendix A.
- [ ] Unit tests verifying serialization shape and exhaustive `code` enum coverage.
- [ ] Typecheck + lint pass.

#### US-443: innerHTML setter — htmlparser2 integration

**Description:** Parse HTML and build PAPI subtree. Cite Shim_Design §7.2.
**Estimate:** 1.5 d
**Acceptance Criteria:**

- [ ] Uses `htmlparser2` (already a devDependency) — promote to dependency if needed for runtime.
- [ ] Walk AST: each element → `document.createElement(tag)` (with tag map), each text → `document.createTextNode(text)`.
- [ ] `script` and `link` tags: SKIP, emit `DOMShimDivergenceWarning('shim:L3b/script-skipped')`.
- [ ] `style` tag: SKIP, emit `DOMShimDivergenceWarning('shim:L3b/css-style-tag-dropped')`.
- [ ] Inline `on*` attributes: SKIP (security), warn `shim:L3b/inline-event-attrs-ignored`.
- [ ] Attributes applied via `setAttribute`; `style="..."` parsed via simple `key: value;` split and set via `style.setProperty`; `class="..."` via `className`; `data-*` via dataset.
- [ ] Cleared previous children of `this`; appended new subtree.
- [ ] Auto-flush.
- [ ] Unit tests: `el.innerHTML = '<div class="x"><span>hi</span></div>'; el.firstChild.tagName === 'DIV'; el.querySelector('.x span').textContent === 'hi'`.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-444: innerHTML getter — canonical serializer

**Description:** Walk tree, emit canonical HTML. Cite Shim_Design §7.2, divergence `shim:L3b/serialization-canonical`.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] Walks `__GetChildren` + `__GetAttributes` + `__GetClasses` + `__GetInlineStyles`.
- [ ] Output canonical: attributes sorted alphabetically, double-quoted, void elements self-close.
- [ ] Raw-text children emitted as text.
- [ ] Round-trip is NOT guaranteed; document.
- [ ] Unit tests: build a tree, call getter, expected canonical string.
- [ ] Typecheck + lint pass.

#### US-445: outerHTML + insertAdjacentHTML + insertAdjacentText

**Description:** Inherits innerHTML pipeline. Cite Shim_Design §7.1, §7.3.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `outerHTML` getter wraps innerHTML in self's tag + attrs.
- [ ] `outerHTML` setter parses and `replaceWith`-on-parent.
- [ ] `insertAdjacentHTML('beforebegin'|'afterend'|'afterbegin'|'beforeend', html)` per spec.
- [ ] `insertAdjacentText(pos, text)` is a shortcut.
- [ ] Unit tests for each position.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-446: textContent setter

**Description:** Bulk replace children with one raw-text. Cite Shim_Design §7.3 `shim:L3b/text-emulated`.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `set textContent(v)`: remove all children, `__CreateRawText(v)`, append.
- [ ] If `this` is not a Lynx text-host element, auto-wrap in a `<text>` element per `shim:L3b/text-emulated` (or for v0, just attach raw text directly and let engine reject if needed; document).
- [ ] Unit test: round-trip `el.textContent = 'hello'; el.textContent === 'hello'`.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-447: style.cssText setter

**Description:** Parse declarations, apply all. Cite Shim_Design §7.3 `shim:L3b/cssText-reorder`.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] Parse `'color: red; background: blue'` into `{ color: 'red', background: 'blue' }` (basic CSS declaration parser; comments stripped).
- [ ] Clear cache then `__SetInlineStyles(papi, parsed)`.
- [ ] `style.cssText` getter emits canonical string from cache.
- [ ] Unit test: round-trip + canonical output.
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

#### US-448: Tier-narrowing runtime helpers (US-475)

**Description:** Runtime casts to narrow types. Cite Shim_Design §2 "Tier selection", OQ-S.6.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] OQ-S.6 resolution captured at top of file: "Helpers are both type-level (cast) and runtime (Proxy that throws on too-high-tier method access). Default is type-level only; opt-in runtime guard via `import { ReadOnly } from '@lynx-js/dom-shim/tiers/strict'`."
- [ ] `packages/dom-shim/src/runtime/tiers.ts`: exports `ReadOnly(el): L1ReadOnlyElement`, `SafeWrite(el): L2SafeWritableElement`, `Events(el): L3aEventfulElement`, `Unsafe(el): L3bUnsafeWritableElement`.
- [ ] Type-level: each cast returns the matching interface; calling a higher-tier method on the narrowed result is a compile error.
- [ ] Strict variant (`@lynx-js/dom-shim/tiers/strict`): runtime Proxy throws `DOMShimUnsupportedError({ code: 'L4/tier-violation' })` if a higher-tier method is called.
- [ ] Unit tests for both modes.
- [ ] Typecheck + lint pass.

#### US-449: Divergence diagnostic emission

**Description:** Wire up `console.warn` for each documented divergence code, exactly once per (code, element). Cite Shim_Design Appendix A.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/src/runtime/diagnostics.ts` exposes `warnOnce(code, surface, el?)`.
- [ ] WeakMap-tracked dedupe per (code, papi-uid).
- [ ] JSON-serializable warning shape per Appendix A.
- [ ] Documented codes in `SPEC/DIAGNOSTICS.md`: catalog of all `shim:Lx/...` codes the runtime emits.
- [ ] Unit test: trigger same divergence twice, assert single warn.
- [ ] Typecheck + lint pass.

#### US-450: M5 exit integration test — v0/Bolt/Artifacts samples

**Description:** Run scraped samples through L3b innerHTML pipeline. Cite §G3.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/test-corpus/llm-samples/` directory with ≥30 HTML snippets scraped from v0.dev / Bolt / Claude Artifacts (use existing prompts from Phase 1 corpus where possible).
- [ ] `__tests__/M5-llm-corpus.test.ts` reads each snippet, sets as innerHTML on a fresh element, asserts no thrown errors and that resulting tree's `querySelector(*)` returns non-zero.
- [ ] Pass rate ≥70% (allow some failures for samples with Shadow DOM / customElements which legitimately throw L4).
- [ ] Verified against real-Lynx mock.
- [ ] Typecheck + lint pass.

---

### Milestone 6 — L4 Unsupported

#### US-451: Shadow DOM + customElements throws

**Description:** L4 stubs for shadow-tree APIs. Cite Shim_Design §8.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `el.attachShadow(opts)` throws with `code: 'L4/shadow-dom'`, `suggestion: 'Use a Shim-side prefix/scoping convention on class names.'`
- [ ] `el.shadowRoot` getter returns null and warns once.
- [ ] `customElements` global throws on `define()`, `whenDefined()`, etc.
- [ ] Unit tests: catch error, assert `code` matches.
- [ ] Typecheck + lint pass.

#### US-452: document.cookie / localStorage / sessionStorage / location / history

**Description:** L4 stubs for browser-storage and navigation. Cite Shim_Design §8.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] All five APIs throw on access with appropriate `code`s.
- [ ] `window.location` getter returns a stub that throws on any property read.
- [ ] `history.pushState/replaceState` throw.
- [ ] Unit tests assert each.
- [ ] Typecheck + lint pass.

#### US-453: MutationObserver / IntersectionObserver / ResizeObserver

**Description:** L4 stubs for observer APIs. Cite Shim_Design §8.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `new MutationObserver(cb)` throws with `code: 'L4/mutation-observer'`.
- [ ] Same for `IntersectionObserver`, `ResizeObserver`.
- [ ] Unit tests assert each `code`.
- [ ] Typecheck + lint pass.

#### US-454: getComputedStyle (non-inline) + CSSOM construct

**Description:** L4 throws for resolved styles and stylesheet construction. Cite Shim_Design §8.2.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `getComputedStyle(el)` returns a stub where `getPropertyValue(name)` returns inline-style value if present, else throws `code: 'L4/computed-style-non-inline'`.
- [ ] `new CSSStyleSheet()` throws `code: 'L4/cssom-construct'`.
- [ ] `document.styleSheets` throws on access.
- [ ] Unit tests.
- [ ] Typecheck + lint pass.

#### US-455: Remaining L4 surfaces — Range, Selection, Pointer/Drag, Fullscreen, XHR, etc.

**Description:** Sweep the remaining §8.2 list. Cite Shim_Design §8.2.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] Throw for: `new Range()`, `window.getSelection()`, `window.open()`, `alert/confirm/prompt`, `XMLHttpRequest`, `el.innerText` (getter), `el.requestFullscreen()`, `el.requestPointerLock()`, Pointer event types (`pointerdown` etc) at `addEventListener` time, Drag event types.
- [ ] All from Shim_Design §8.2 list covered. SPEC/UNSUPPORTED.md ships with full enumeration.
- [ ] Unit test: iterate each surface, assert throws with correct `code`.
- [ ] Typecheck + lint pass.

---

### Milestone 7 — WPT conformance

#### US-461: WPT subset cherry-pick definition

**Description:** Pin which WPT tests are in scope. Cite Shim_Design §11, Phase_2_to_5_Roadmap.md §US-501.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/wpt/SUBSET.md` lists every WPT test file in scope, organized by directory. Initial list per Shim_Design §11.
- [ ] `packages/dom-shim/wpt/subset.json` machine-readable: `{ directories: [{ path, expectedPassRate, tests: [...] }] }`.
- [ ] Cherry-picked from `web-platform-tests/wpt` at a pinned commit (recorded in JSON).
- [ ] Subset prioritizes the directories Shim_Design §11 lists; excludes everything else.
- [ ] Total test count ≤500 (to keep CI under 5 min).
- [ ] Typecheck + lint pass on tooling.

#### US-462: WPT runner harness

**Description:** Adapt the upstream wpt runner to drive the Shim instead of a browser. Cite Phase_2_to_5_Roadmap §US-502.
**Estimate:** 1.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/wpt/run.ts` reads each test file (`.html`), extracts the test script via a minimal HTML parser, executes against a fresh Shim `document`.
- [ ] Wires `testharness.js` globals (`test`, `async_test`, `promise_test`, `assert_*`) into the runner.
- [ ] Emits per-test result: `{ file, name, status: 'pass'|'fail'|'error'|'skip', message?, diagnostics: DiagnosticCode[] }`.
- [ ] Skips tests requiring browser features the Shim L4-throws (auto-detected via code: 'L4/...').
- [ ] CLI: `pnpm wpt-runner --output baseline.json`.
- [ ] Unit test of runner with a synthetic 2-test WPT file: 1 passes, 1 fails. Output shape correct.
- [ ] Typecheck + lint pass.

#### US-463: baseline.json generator

**Description:** Generate the canonical baseline report. Cite Phase_2_to_5_Roadmap §US-503.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/wpt/baseline.json` (committed): summary per directory, total pass-rate, per-test status.
- [ ] CLI `pnpm wpt-update-baseline` re-generates after intentional changes.
- [ ] Schema documented in `packages/dom-shim/wpt/BASELINE_SCHEMA.md`.
- [ ] Initial commit reflects M5-exit state (pass rate likely 30-50%).
- [ ] Typecheck + lint pass.

#### US-464: CI gate — pass rate must not regress

**Description:** PR check. Cite Phase_2_to_5_Roadmap §US-503, §US-507.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `.github/workflows/dom-shim-wpt.yml`: on PR, runs `pnpm wpt-runner --output current.json`, compares to baseline. Fail if any directory's pass rate drops more than 0.5% OR if total pass rate drops at all.
- [ ] Allows intentional baseline updates via PR (commit changes to `baseline.json` in same PR).
- [ ] Workflow scoped to PRs touching `packages/dom-shim/**`.
- [ ] Typecheck + lint pass.

#### US-465: 70% threshold gate (Ralph completion gate)

**Description:** When the overall pass rate hits 70%, Ralph emits the completion promise. Cite §G5.
**Estimate:** 0.25 d
**Acceptance Criteria:**

- [ ] `scripts/ralph-shim/check-wpt-gate.ts`: reads baseline.json, prints `WPT_SUBSET_70PCT_PASS` if total pass rate ≥0.70, else prints `WPT_SUBSET_BELOW_GATE: X%`.
- [ ] Ralph boot sequence reads this output at end of each iteration to decide if it should emit the completion promise.
- [ ] Typecheck + lint pass.

#### US-466: Per-directory drill-down dashboard data

**Description:** Aggregated stats for the dashboard. Cite §G7.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/wpt/dashboard-data.json` aggregates baseline by directory + diagnostic-code histogram.
- [ ] Includes: total tests per dir, pass count, fail count, top-5 failure reasons per dir.
- [ ] Generated alongside baseline.json.
- [ ] Typecheck + lint pass.

#### US-467: Dashboard static site

**Description:** Renderable HTML page. Cite §G7, Phase_2_to_5_Roadmap §US-507.
**Estimate:** 1 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/dashboard/` contains a static site rendering `dashboard-data.json` as: top-level pass-rate gauge, per-directory bar chart, sortable test table.
- [ ] Built with vanilla HTML/CSS/JS or a minimal framework — Shim must NOT be self-hosted (avoid circular dependency).
- [ ] CI publishes to GitHub Pages on main-branch merges. Workflow: `.github/workflows/dom-shim-dashboard.yml`.
- [ ] Verified by opening in a browser locally.
- [ ] Typecheck + lint pass.

#### US-468: CI badge in README

**Description:** Shields.io badge wired to the dashboard URL. Cite Phase_2_to_5_Roadmap §OQ-5.2.
**Estimate:** 0.25 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/README.md` shows a badge: "WPT subset: X% pass" linking to the dashboard.
- [ ] Badge data sourced from `dashboard-data.json` published to GH Pages.
- [ ] Typecheck + lint pass.

#### US-469: React Native API parity audit

**Description:** Verify Shim covers every RN ReadOnlyNode/Element method. Cite §G6.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `packages/dom-shim/SPEC/RN_PARITY.md` lists every property/method on `https://reactnative.dev/docs/nodes` and `https://reactnative.dev/docs/elements` (ReactNativeElement page).
- [ ] Each entry marked ✅ (Shim equivalent at tier N), ⏳ (planned), ❌ (intentionally out of scope, justification given).
- [ ] Coverage ≥ RN's surface — every ✅ has a passing unit test reference.
- [ ] Typecheck + lint pass on doc tooling.

#### US-470: M7 exit integration test

**Description:** Final integration test ensuring all milestones land. Cite §G5.
**Estimate:** 0.5 d
**Acceptance Criteria:**

- [ ] `__tests__/M7-exit.test.ts`: runs `pnpm wpt-runner`, asserts overall pass rate ≥70%.
- [ ] Asserts every L4 surface from `SPEC/UNSUPPORTED.md` throws with the right `code`.
- [ ] Asserts every divergence in `SPEC/DIAGNOSTICS.md` emits at most one warning per (code, element).
- [ ] Asserts RN_PARITY.md has no ❌ for any L1/L2 entry.
- [ ] Typecheck + lint pass.

---

### Cross-cutting (referenced from milestones above)

The 5 cross-cutting stories already landed under their natural milestones:

- US-471 ↔ US-411 (auto-flush scheduler)
- US-472 ↔ US-412 (write-through cache)
- US-473 ↔ US-441 (tag map)
- US-474 ↔ US-442 (error hierarchy)
- US-475 ↔ US-448 (tier-narrowing helpers)

If Ralph encounters one of these IDs in another story's reference, it refers to the implementation in the merged story.

---

## 6. Functional Requirements

- **FR-1:** `@lynx-js/dom-shim/runtime` exports a `document` global that satisfies the L1+L2+L3 surface from Shim_Design §9.
- **FR-2:** Every L2+ write is immediately consistent with the corresponding L1 read in the same JS frame (write-through cache).
- **FR-3:** Tree mutations auto-schedule `__FlushElementTree` at the next microtask. Caller may opt out via `setAutoFlush(false)`.
- **FR-4:** Event handlers fire in registration order; multiple handlers per (type) supported; spec dedupe respected.
- **FR-5:** `innerHTML` setter parses HTML, builds a Shim-mediated PAPI subtree, and emits documented `DOMShimDivergenceWarning`s for `<script>`, `<style>`, `<img>` (no load event), and inline event attributes.
- **FR-6:** Every L4-listed surface throws `DOMShimUnsupportedError` with structured shape from Appendix A.
- **FR-7:** WPT runner produces a `baseline.json` validated by `BASELINE_SCHEMA.md`.
- **FR-8:** CI workflow gates merges on no-regression of WPT pass rate.
- **FR-9:** Public dashboard renders pass-rate from `dashboard-data.json`.
- **FR-10:** Package surface meets or exceeds React Native's Nodes API per `RN_PARITY.md`.

---

## 7. Non-Goals

- **NG-1:** No new Engine PAPI primitives. Phase 3 of the roadmap is explicitly outside this PRD. Workarounds (cache, O(n) walk) are documented in Shim_Design §3.2.
- **NG-2:** No dual-thread Shim. Single main-thread only. Dual-thread compatibility documented as `shim:L3a/dual-thread-affinity` divergence.
- **NG-3:** No full CSSOM. Inline style only.
- **NG-4:** No `MutationObserver` / `IntersectionObserver` / `ResizeObserver` — all L4.
- **NG-5:** No `getComputedStyle` for non-inline properties.
- **NG-6:** No Shadow DOM, customElements, Range, Selection, Clipboard, Fullscreen, PointerLock, Speech.
- **NG-7:** No automatic Lynx engine version negotiation — Shim assumes target engine ≥ the `@lynx-js/type-element-api` version it was published against.
- **NG-8:** No HTML form submission semantics — `form.submit()` throws L4.
- **NG-9:** No native bridge / Rust / C++ changes.
- **NG-10:** No replacement for `packages/dom-shim/benchmarks/` — that remains the Phase 1/1.5 codebase.
- **NG-11:** No competing with `packages/testing-library/testing-environment/src/dom-shim/` — different goal (test assertions vs runtime). If overlap surfaces during M3, raise in Ralph progress log; do not merge.

---

## 8. Technical Considerations

### 8.1 Package layout

Existing `packages/dom-shim/` extended:

```
packages/dom-shim/
├── package.json              # @lynx-js/dom-shim — gain "exports": { ".": ..., "./runtime": ..., "./tiers": ..., "./tiers/strict": ... }
├── src/
│   ├── index.ts              # (existing; placeholder)
│   └── runtime/              # NEW — this PRD
│       ├── index.ts          # entry: { document, wrapPapi, L1ReadOnlyNode, ... }
│       ├── nodes.ts          # L1ReadOnlyNode, L1ReadOnlyText
│       ├── elements.ts       # L1ReadOnlyElement
│       ├── safe-write.ts     # L2SafeWritableElement
│       ├── events.ts         # ShimEvent, L3aEventfulElement, trampoline
│       ├── unsafe-write.ts   # L3bUnsafeWritableElement, innerHTML pipeline
│       ├── document.ts       # ShimDocument
│       ├── classlist.ts      # L2DOMTokenList
│       ├── style.ts          # L2CSSStyleDeclaration
│       ├── dataset.ts        # dataset proxies
│       ├── scheduler.ts      # US-411 microtask scheduler
│       ├── cache.ts          # US-412 write-through cache
│       ├── tag-map.ts        # US-441 tag map loader
│       ├── tiers.ts          # US-448 narrowing helpers
│       ├── tiers-strict.ts   # US-448 runtime-guarded narrowing
│       ├── diagnostics.ts    # US-449 warnOnce
│       ├── errors.ts         # US-442 error hierarchy
│       ├── wrap.ts           # wrapPapi factory
│       └── __tests__/        # vitest test files (M1..M7 exit tests + per-feature)
├── SPEC/
│   ├── TAG_MAP.json
│   ├── DIAGNOSTICS.md
│   ├── UNSUPPORTED.md
│   ├── RN_PARITY.md
│   └── BASELINE_SCHEMA.md
├── wpt/
│   ├── SUBSET.md
│   ├── subset.json
│   ├── run.ts                # WPT runner
│   ├── baseline.json
│   └── dashboard-data.json
├── dashboard/
│   ├── index.html
│   ├── styles.css
│   └── render.js
├── benchmarks/               # (existing Phase 1; untouched)
└── test-corpus/              # NEW — LLM HTML samples for US-450
    └── llm-samples/
```

### 8.2 Dependencies

- Runtime: `htmlparser2` (move from devDeps to deps for US-443).
- Dev / test: `vitest` (add); `@lynx-js/type-element-api` already implicit via globals.
- No new heavy deps — bundle budget concern from Phase_2_to_5_Roadmap §OQ-4.1.

### 8.3 Build & lint

- ESLint per-package override at `packages/dom-shim/**/*.ts` already disables `n/file-extension-in-import` (per CLAUDE.md note about strip-types). Verify still in place.
- Biome forbids `console.log` — use `console.info` / `console.warn` only.
- ESLint forbids `process.exit` — `throw` and let propagate.
- `pnpm -F @lynx-js/dom-shim typecheck`, `pnpm -F @lynx-js/dom-shim test:runtime`, `pnpm -F @lynx-js/dom-shim wpt-runner` are the three core commands Ralph runs.

### 8.4 Real Lynx mock integration

US-153 from Phase_1_5_PRD.md ships a "real Lynx mock" (an MITM-ish JS realization of the PAPI surface that more accurately models engine behavior than the n=10 mock). All L2+ stories list "verified against real-Lynx mock if available" — Ralph checks `packages/dom-shim/benchmarks/src/mocks/real-lynx-mock.ts` and uses it if present; otherwise falls back to the existing `mock-papi.ts`.

### 8.5 Parallel session awareness

A parallel session is executing Phase_1_5_PRD.md on the same worktree. Files Ralph **must NOT** modify in this PRD's scope:

- `packages/dom-shim/benchmarks/**` (Phase 1/1.5 territory)
- `packages/dom-shim/SMOKE_TEST_*.{md,json}` (Phase 1.5 outputs)
- `packages/dom-shim/SPOT_CHECK_*.{md,json}` (Phase 1 outputs)
- `Phase_1_5_PRD.md`, `PRD.md` (other PRDs)

If Ralph sees these files changed externally, treat as the parallel session's work — do not revert.

---

## 9. Success Metrics

- **M9.1** — WPT subset pass rate ≥70% in CI (G5, Ralph gate).
- **M9.2** — Vanilla TodoMVC runs against the Shim with zero L4 throws and correct UI state (G2).
- **M9.3** — ≥30 v0/Bolt/Artifacts samples render correctly (G3).
- **M9.4** — `RN_PARITY.md` shows zero ❌ entries for L1/L2 (G6).
- **M9.5** — Diagnostic catalog (`SPEC/DIAGNOSTICS.md`) is complete and every emitted code is documented.
- **M9.6** — Dashboard renders publicly and the badge updates on main merges.

---

## 10. Open Questions

Resolved by user (do not re-decide):

- ✅ **OQ-S.1:** Auto-flush at microtask boundary (US-411).
- ✅ **OQ-S.2:** Permissive tag fallback (US-425, US-441).

Resolved by the story that introduces the relevant API (each story's first AC):

- **OQ-S.3:** style.priority cache-only, NOT propagated to PAPI. Divergence `shim:L2/no-important-propagation`. Resolution captured in US-417.
- **OQ-S.4:** getBoundingClientRect first-call returns zero rect + schedules async + warns. Resolution captured in US-409.
- **OQ-S.5:** DocumentFragment via `__CreateWrapperElement`; if engine doesn't auto-flatten on append, Shim flattens in JS. Resolution captured in US-424.
- **OQ-S.6:** Tier-narrowing both type-level (default) and runtime-guarded (`@lynx-js/dom-shim/tiers/strict`, opt-in). Resolution captured in US-448.
- **OQ-S.7:** document.body pinned via `setBody(ref)` Shim init; default: first child of page if present, else page itself; document choice with `console.info` once. Resolution captured in US-425.
- **OQ-S.8:** Tag-map version pinned to package SemVer; breaking tag-map change = major bump. Resolution captured in US-441.

Late-stage open questions (decided during M7):

- **OQ-S.9** (new) — How aggressively to skip WPT tests that legitimately can't pass given Shim's L4 surface. Default: skip if test setup throws `L4/*`. Recommend logging skip rationale per test.
- **OQ-S.10** (new) — Dashboard hosting URL. Suggestion: `lynx-shim-conformance.lynxjs.org`. Confirm with team during US-467.

---

## 11. Dependency Graph

```
US-401 (bootstrap) ──┬──► US-402 (traversal) ──┬──► US-403 (prevSibling)
                     │                          ├──► US-404 (id/class read)
                     │                          ├──► US-405 (attr read)
                     │                          ├──► US-406 (dataset read)
                     │                          ├──► US-407 (element children)
                     │                          ├──► US-408 (selectors)
                     │                          ├──► US-409 (rect async)
                     │                          └──► US-410 (text node)
                     │
                     ▼
                  US-474 (errors) ◄────── needed for all L4 throws and InvariantError
                  US-442 = US-474 (same story)
                     │
                     ▼  (M1 exit)
                  
                  US-411 (scheduler) ──┐
                  US-412 (cache)      ──┴──► US-413..US-420 (L2 props)
                                                  │
                                                  └──► US-475/US-448 (tier narrowing)
                                                          │
                                                          ▼ (M2 exit)
                                                  
                                                  US-421..US-426 (L2 tree + frag)
                                                          │
                                                          ▼ (M3 exit + TodoMVC static)
                                                  
                                                  US-431 (ShimEvent)
                                                          │
                                                          ▼
                                                  US-432 (addEventListener)
                                                          │
                                                          ├──► US-433 (remove + once)
                                                          ├──► US-434 (capture + bubble)
                                                          └──► US-435 (dispatchEvent throw + TodoMVC)
                                                                  │
                                                                  ▼ (M4 exit)
                                                  
                                                  US-441/US-473 (tag map)
                                                          │
                                                          ├──► US-443 (innerHTML set)
                                                          ├──► US-444 (innerHTML get)
                                                          ├──► US-445 (outer + adjacent)
                                                          ├──► US-446 (textContent set)
                                                          ├──► US-447 (cssText)
                                                          └──► US-449 (diagnostics emission)
                                                                  │
                                                                  ▼
                                                          US-450 (LLM corpus exit)
                                                                  │
                                                                  ▼ (M5 exit)
                                                  
                                                  US-451..US-455 (L4 throws sweep)
                                                          │
                                                          ▼ (M6 exit)
                                                  
                                                  US-461 (WPT subset)
                                                          │
                                                          ▼
                                                  US-462 (WPT runner)
                                                          │
                                                          ▼
                                                  US-463 (baseline.json)
                                                          │
                                                          ├──► US-464 (CI gate)
                                                          ├──► US-465 (70% gate)
                                                          ├──► US-466 (dashboard data)
                                                          ├──► US-467 (dashboard site)
                                                          ├──► US-468 (badge)
                                                          └──► US-469 (RN parity audit)
                                                                  │
                                                                  ▼
                                                          US-470 (M7 exit + completion promise)
                                                                  │
                                                                  ▼
                                                  RALPH EMITS <promise>WPT_SUBSET_70PCT_PASS</promise>
                                                  IFF baseline.json total pass rate ≥ 0.70
```

Critical path: **US-401 → US-411 → US-412 → US-417 → US-421 → US-432 → US-443 → US-461 → US-470.** Everything else parallelizable in chunks.

---

## 12. Ralph Boot Sequence

**This section is authoritative for the Ralph autonomous loop.**

### 12.1 Pre-flight checks (every iteration)

1. **Read this PRD's §11 dependency graph and §5 story list.**
2. **Read `Shim_Design.md` if not in current context** — it is the canonical spec; AC of stories cite it.
3. **Read `scripts/ralph-shim/progress.txt`** — persistent state across iterations. Format:
   ```
   current_story: US-413
   m1_exit: 2026-06-15T10:23Z
   m2_exit: (pending)
   wpt_pass_rate: 0.42
   notes: "US-413 done; next is US-414"
   ```
4. **Check git state:** `cd /Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark && git status`. Branch must be `Huxpro/lynx-dom-shim-benchmark`. If files are modified that this PRD's §8.5 lists as "must NOT modify", do NOT revert — those are the parallel session's work.
5. **Source Node 22:** `export PATH="/Users/bytedance/.nvm/versions/node/v22.19.0/bin:$PATH"` before any `pnpm` command. Cwd does NOT persist across Bash calls — always use absolute paths.

### 12.2 Per-iteration loop

```
WHILE NOT done:
  1. Pick next story from §5 in dependency order (read progress.txt for current).
  2. Read the story's AC; read the cited Shim_Design.md section.
  3. Implement minimal code to satisfy AC.
  4. Run: pnpm -F @lynx-js/dom-shim typecheck
          pnpm -F @lynx-js/dom-shim test:runtime
          pnpm biome lint packages/dom-shim/src/runtime
          pnpm eslint packages/dom-shim/src/runtime
  5. If all green: commit with conventional message "feat(dom-shim): US-XXX <title>"
     Update scripts/ralph-shim/progress.txt
     Move to next story.
  6. If red: do NOT skip. Diagnose and fix. If genuinely blocked >2 iterations,
     write a BLOCKER note to progress.txt and pick a non-blocked story.
  7. After every milestone exit story (US-410, US-420, US-426, US-435, US-450, US-455, US-470):
     run the milestone exit integration test from that story's AC.

  8. IF current story is US-470:
     pnpm -F @lynx-js/dom-shim wpt-runner --output /tmp/current.json
     pass_rate = node scripts/ralph-shim/check-wpt-gate.ts /tmp/current.json
     IF pass_rate >= 0.70:
       Update baseline.json
       commit
       Output: <promise>WPT_SUBSET_70PCT_PASS</promise>
       EXIT loop
     ELSE:
       Identify lowest-pass-rate directory from dashboard-data.json
       Pick the next-most-impactful story (or open a new story) to raise it
       Continue loop
```

### 12.3 Multi-session warnings

- **This PRD spans MANY iterations and likely MANY sessions** (estimated 9 weeks if a single human did it).
- **Context summarization will happen.** After summarization, the FIRST thing Ralph does is re-read this PRD and progress.txt. Do not rely on memory of intermediate decisions; everything is in the files.
- **Never lie about progress to exit the loop.** The completion promise `WPT_SUBSET_70PCT_PASS` MUST be backed by a real ≥0.70 pass rate in `current.json` from `wpt-runner`. If Ralph believes it's stuck, write a BLOCKER note and STOP without emitting the promise — the user can resume manually.
- **Never run the full Phase 1 benchmark sweep** (the 50-prompt × 2-route × 3-round LLM run). That is a separate budgeted activity from Phase 1.5. The Shim PRD's tests are unit + WPT only, no LLM API spend.
- **Never modify files listed in §8.5.** If you see them changed externally, that is the parallel Phase 1.5 session — leave it alone.
- **If Phase 1.5 US-153 lands a real-Lynx mock during your work**, switch the unit tests to use it. Check `packages/dom-shim/benchmarks/src/mocks/real-lynx-mock.ts` existence on every iteration boot.

### 12.4 Completion gate (exact)

```bash
cd /Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark
export PATH="/Users/bytedance/.nvm/versions/node/v22.19.0/bin:$PATH"
pnpm -F @lynx-js/dom-shim wpt-runner --output /tmp/wpt-result.json
node scripts/ralph-shim/check-wpt-gate.ts /tmp/wpt-result.json
# prints either: WPT_SUBSET_70PCT_PASS
#         or:    WPT_SUBSET_BELOW_GATE: 0.XX
```

Only if the script prints `WPT_SUBSET_70PCT_PASS` does Ralph emit `<promise>WPT_SUBSET_70PCT_PASS</promise>` and exit.

### 12.5 Initial Ralph kickoff command (for the human launching the loop)

```bash
cd /Users/bytedance/github/lynx-stack/.worktrees/lynx-dom-shim-benchmark
mkdir -p scripts/ralph-shim
echo "current_story: US-401" > scripts/ralph-shim/progress.txt
echo "started_at: $(date -Iseconds)" >> scripts/ralph-shim/progress.txt
# Then in Claude Code:
/ralph-loop --max-iterations 200 --completion-promise WPT_SUBSET_70PCT_PASS
# (with this PRD's path as the prompt anchor)
```

The `max-iterations 200` cap is intentionally generous — multi-session execution will burn iterations on context summarization re-reads. Better to over-cap than to hit the limit mid-milestone.

---

## 13. Appendix: cross-reference

This PRD's stories correspond to the milestones in Shim_Design §13 and to the open questions OQ-S.* defined there. To verify completeness, every Shim_Design §-section is implemented by at least one story:

| Shim_Design §                   | Stories                                 |
| ------------------------------- | --------------------------------------- |
| §1 Constraints                  | (informational; no story)               |
| §2 Tier model                   | US-401 (skeleton), US-448 (narrowing)   |
| §3 PAPI surface                 | (informational)                         |
| §4 Tier 1 ReadOnly              | US-402..US-410                          |
| §5 Tier 2 SafeWritable          | US-411..US-426                          |
| §6 Tier 3a Events               | US-431..US-435                          |
| §7 Tier 3b UnsafeWritable       | US-441..US-450                          |
| §8 Tier 4 Unsupported           | US-451..US-455                          |
| §9 Document & Window            | US-425                                  |
| §10 Capability Matrix           | (validated by US-469 RN parity)         |
| §11 Conformance Goals           | US-461..US-470                          |
| §12 Open Decisions              | resolved in stories per §10 of this PRD |
| §13 Implementation Order        | mirrored as Milestones §4               |
| §14 Risk register               | (informational)                         |
| §15 What this design says NO to | Non-Goals §7                            |
| Appendix A Diagnostic format    | US-442 / US-474                         |
| Appendix B PAPI used vs unused  | (informational)                         |

**End of PRD.**
