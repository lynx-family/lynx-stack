# Plan: Vue Lynx Testing Infrastructure

## Context

The Vue 3 Lynx implementation (`packages/vue/`) currently has no automated tests. We need two testing layers:

1. **E2E Pipeline Tests** (high priority) — validate the full dual-thread pipeline: Vue component → ShadowElement → ops → `callLepusMethod` → `applyOps` → PAPI → JSDOM. This is where most bugs live.
2. **Vue Upstream Tests** (medium priority) — run `vuejs/core` `runtime-core` test suite against our ShadowElement-based renderer to validate that our `nodeOps` implementation satisfies Vue's renderer contract.

---

## Phase 1: E2E Pipeline Testing Library

**Package**: `packages/vue/testing-library/` (`@lynx-js/vue-testing-library`, private)

Reuses `@lynx-js/testing-environment` (framework-agnostic) with a thin Vue-specific layer.

### 1.1 Required changes to `packages/vue/runtime/`

**`src/index.ts`** — Add `unmount()` to `VueLynxApp` (calls `internalApp.unmount()`)

**`src/event-registry.ts`** — Export `resetRegistry()` to clear `handlers` Map and reset `signCounter`

**`src/node-ops.ts`** — Export `resetNodeOpsState()` to clear `elementEventSigns` Map

**`src/flush.ts`** — Export `resetFlushState()` to reset `scheduled` flag

**`src/ops.ts`** — `takeOps()` already drains buffer (sufficient for reset)

**`src/index.ts`** — Re-export a combined `resetForTesting()` that calls all the above resets

### 1.2 New files in `packages/vue/testing-library/`

**`package.json`** — private, devDeps: `@lynx-js/testing-environment`, `@lynx-js/vue-runtime`, `@lynx-js/vue-main-thread`, `@testing-library/dom`, `jsdom`, `vitest`, `vue`

**`vitest.config.ts`** — Alias `@lynx-js/vue-runtime` → `../runtime/src/index.ts` (source, so `declare var lynx` resolves to `globalThis.lynx` set by LynxTestingEnv). Same for `@lynx-js/vue-main-thread` → `../main-thread/src/entry-main.ts`. Environment: `jsdom`. Setup file: `./setup.ts`.

**`setup.ts`** — Core wiring:

1. Create `LynxTestingEnv` using vitest's JSDOM
2. Switch to BG thread, wire `publishEvent` onto `globalThis` and `lynxCoreInject.tt`
3. Wire Main Thread globals: `renderPage` (calls `__CreatePage`, stores page as `elements.set(1, page)`), `vuePatchUpdate` (parses JSON ops, calls `applyOps`)
4. Set `globalThis.lynxTestingEnv`
5. Reference: `packages/react/testing-library/src/vitest-global-setup.js` and `packages/react/preact-upstream-tests/setup-shared.js`

**`src/render.ts`** — `render(rootComponent, options?)`:

1. Call `cleanup()`
2. Switch to MT, call `renderPage({})`
3. Switch to BG, reset `ShadowElement.nextId = 2`, call `resetForTesting()`
4. `createApp(rootComponent, props).mount()` — mount is synchronous; `queuePostFlushCb(doFlush)` fires within the same scheduler flush; `callLepusMethod` in LynxTestingEnv is synchronous → ops applied to JSDOM before `mount()` returns
5. Return `{ container, unmount, ...getQueriesForElement(container) }`

**`src/fire-event.ts`** — Switch to BG thread before dispatching (event handlers run on BG), dispatch DOM event via `@testing-library/dom`, restore thread. Provide named helpers: `fireEvent.tap`, `fireEvent.longtap`, etc. Event type format: `"bindEvent:tap"` (matches `__AddEvent` registration). Reference: `packages/react/testing-library/src/fire-event.ts`

**`src/index.ts`** — Export `render`, `cleanup`, `fireEvent`, re-export `@testing-library/dom`

### 1.3 Initial test files

**`src/__tests__/render.test.ts`** — static render, text content, nested elements
**`src/__tests__/reactivity.test.ts`** — `ref` updates → re-render → verify JSDOM changes
**`src/__tests__/events.test.ts`** — `bindtap` handler fires, state updates, re-renders
**`src/__tests__/styles.test.ts`** — inline styles applied via `__SetInlineStyles`
**`src/__tests__/v-if-v-for.test.ts`** — conditional/list rendering with comment anchors

### 1.4 Key technical risks

- **`lynx` / `lynxCoreInject` ambient variables**: These are `declare var` in flush.ts / entry-background.ts. Must alias to source (not dist) and ensure LynxTestingEnv sets them on globals BEFORE importing the modules. Vitest's lazy module loading should help — modules are loaded when tests run, by which time setup.ts has already executed.
- **Synchronous flush assumption**: If `queuePostFlushCb` doesn't fire within `mount()`, reactive updates in initial render won't be reflected. Fallback: make `render()` async with `await nextTick()`.
- **Module singleton isolation**: ops buffer, event registry, flush state are module-level. `resetForTesting()` must clear all of them between tests.

---

## Phase 2: Vue Upstream Tests

**Package**: `packages/vue/vue-upstream-tests/` (`@lynx-js/vue-upstream-tests`, private)

### 2.1 Git submodule

Add `vuejs/core` as submodule at `packages/vue/vue-upstream-tests/core`, pinned to a stable tag (e.g., `v3.5.13`).

Scripts: `vuejs:init` (`git submodule update --init ...`), `vuejs:status`

### 2.2 Adapter: `src/lynx-runtime-test.ts`

Replaces `@vue/runtime-test` with an adapter that uses our **real ShadowElement** for tree operations, validating the linked-list implementation.

**Tree**: Uses `ShadowElement` from `../../runtime/src/shadow-element.ts` directly for `createElement`, `createText`, `createComment`, `insert`, `remove`, `parentNode`, `nextSibling`, `setText`, `setElementText`.

**Props/text storage**: Since ShadowElement doesn't store props or text (they go to the ops buffer), the adapter uses `WeakMap<ShadowElement, Record<string, any>>` for props and `WeakMap<ShadowElement, string>` for text content. The adapter's `patchProp` stores into the WeakMap AND calls our real `nodeOps.patchProp` (which pushes ops).

**`serializeInner(el)`**: Walks `el.firstChild` → `.next` linked list (not `.children[]` array). Reads props from WeakMap. Reads text from WeakMap. Outputs `<tag prop="val">children</tag>` format matching `@vue/runtime-test`'s output.

**`triggerEvent(el, event, ...payload)`**: Looks up handler from props WeakMap (`onClick` → `click`), calls it.

**`resetOps()` / `dumpOps()`**: Wraps our `takeOps()` from ops.ts, plus maintains its own logged ops array for format compatibility.

**`render` / `createApp`**: Created via `createRenderer({ patchProp: wrappedPatchProp, ...wrappedNodeOps })`.

**Re-exports**: All of `@vue/runtime-core` (h, ref, reactive, nextTick, etc.)

### 2.3 Vitest config

**`vitest.config.ts`**:

- Alias `@vue/runtime-test` → `./src/lynx-runtime-test.ts`
- Include 18 test files from `core/packages/runtime-core/__tests__/`: rendererElement, rendererChildren, rendererFragment, rendererComponent, component, componentProps, componentSlots, componentEmits, apiLifecycle, apiWatch, apiInject, apiCreateApp, directives, errorHandling, h, vnode, vnodeHooks, scheduler
- Exclude: hydration (SSR), hmr (devtools), rendererOptimizedMode (PatchFlags internals), scopeId (CSS scoping)
- Skiplist plugin (transform `it(` → `it.skip(` based on `skiplist.json`)

**`skiplist.json`**: Starts empty; populated during triage.

### 2.4 What this validates

- ShadowElement linked-list operations (`insertBefore`, `removeChild`) satisfy Vue's VDOM diff contract for keyed/unkeyed children, fragments, component moves
- `parentNode()` / `nextSibling()` return correct values under all edge cases
- `createElement` / `createText` / `createComment` behave correctly
- Our `patchProp` event parsing works with Vue's event patterns

---

## Implementation Order

1. Add `unmount()` + `resetForTesting()` exports to `packages/vue/runtime/`
2. Create `packages/vue/testing-library/` with setup, render, fireEvent
3. Write + debug initial E2E tests (verify full pipeline works)
4. Add vuejs/core submodule, create adapter + vitest config
5. Run upstream tests, triage failures, build skiplist
6. Add to `pnpm-workspace.yaml` (already covers `packages/vue/*`)

## Verification

- **E2E**: `cd packages/vue/testing-library && pnpm test` — all pipeline tests pass
- **Upstream**: `cd packages/vue/vue-upstream-tests && pnpm run vuejs:init && pnpm test` — 80%+ pass rate target
