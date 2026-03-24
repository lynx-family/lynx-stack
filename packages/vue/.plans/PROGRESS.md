# Vue Lynx Implementation — Progress & Next Steps

> **Status as of March 2026**
> We are well past Plan 02. Plans 02, 03, and 04 Phase 1 are complete. Plan 05 (runtime-dom
> pipeline tests) is in progress. The remaining large body of work is Plan 04 Phase 2: the
> compile-time `<script main-thread>` block transform.

---

## What We've Built So Far

### Plan 02 — Dual-Thread MVP ✅ Done

The core architecture is in place. Vue runs on the Background Thread (BG); the Main Thread (MT)
is a lean PAPI executor (~100 lines). They communicate via a flat array of op-codes sent over
`callLepusMethod`.

Key packages created:

- **`packages/vue/runtime/`** — Vue custom renderer for BG. Contains the `ShadowElement` linked
  list (BG-side virtual tree), the `nodeOps` implementation, the ops buffer, the event sign
  registry, and the scheduler hook that flushes ops after every Vue tick.
- **`packages/vue/main-thread/`** — Ops executor for MT. Receives the op array, walks it with a
  switch statement, and calls the appropriate Lynx PAPI functions (`__CreateView`,
  `__AppendElement`, `__SetAttribute`, `__AddEvent`, etc.), then calls `__FlushElementTree()`.
- **`packages/vue/rspeedy-plugin/`** — Build plugin that splits every entry point into a BG
  bundle (Vue + user components) and a MT bundle (executor only), and injects the
  `__MAIN_THREAD__` / `__BACKGROUND__` / `__DEV__` compile-time macros.
- **`packages/vue/e2e-lynx/`** — Demo app with counter, todo-mvc, h-bundle, scroll, and MTS
  demos that exercise the full pipeline on device.

---

### Plan 03 — Testing Infrastructure ✅ Done

Two automated test layers are running:

**E2E pipeline tests** — `packages/vue/testing-library/`

A Vue-specific wrapper around `@lynx-js/testing-environment`. It boots a JSDOM environment,
wires BG and MT globals, and lets you call `render(MyComponent)` and get back DOM queries. All
20 planned tests pass: static render, reactivity, events, inline styles, `v-if`/`v-for`.

Key files:

- `packages/vue/testing-library/setup.ts` — environment wiring (LynxTestingEnv, thread switching,
  `vuePatchUpdate`, `renderPage`)
- `packages/vue/testing-library/src/render.ts` — `render()` helper
- `packages/vue/testing-library/src/fire-event.ts` — `fireEvent.tap()` etc.
- `packages/vue/testing-library/src/__tests__/` — 5 test files (render, reactivity, events,
  styles, v-if/v-for)

**Vue upstream tests (runtime-core)** — `packages/vue/vue-upstream-tests/`

322 of 391 `vuejs/core` runtime-core tests pass against our `ShadowElement` renderer. The 69
skipped are SSR/hydration/HMR tests that don't apply to Lynx. This validates that our
`ShadowElement` linked-list satisfies Vue's full VDOM diff contract.

Key files:

- `packages/vue/vue-upstream-tests/src/lynx-runtime-test.ts` — adapter that replaces
  `@vue/runtime-test` with our real `ShadowElement`
- `packages/vue/vue-upstream-tests/vitest.config.ts` — includes 18 runtime-core test suites

---

### Plan 04 Phase 1 — Main Thread Script Runtime Foundation ✅ Done

The runtime plumbing for Main Thread Script (MTS) is in place. You can hand-craft a worklet
context object and bind it to an element; the op pipeline carries it to MT and registers it via
`__AddEvent({ type: 'worklet', value: ctx })`. The worklet will fire synchronously on MT with
zero thread crossings once the worklet runtime is loaded.

What was added:

- **New op codes** in `packages/vue/runtime/src/ops.ts`:
  - `SET_WORKLET_EVENT = 11` — binds a worklet handler to an element event
  - `SET_MT_REF = 12` — registers a cross-thread element reference

- **`patchProp` extension** in `packages/vue/runtime/src/node-ops.ts` (line ~154):
  Detects props prefixed with `main-thread-` (e.g., `:main-thread-bindtap`,
  `:main-thread-ref`) and emits the appropriate new op codes instead of the normal
  sign-based event ops.

- **MT executor extension** in `packages/vue/main-thread/src/ops-apply.ts` (line ~168):
  Handles `SET_WORKLET_EVENT` and `SET_MT_REF` op codes.

- **`MainThreadRef` composable** — new file
  `packages/vue/runtime/src/main-thread-ref.ts`:
  `useMainThreadRef(initialValue)` returns a ref whose `.value` lives on the MT side.
  Uses Vue's `.value` convention (not React's `.current`). Exported from
  `packages/vue/runtime/src/index.ts`.

- **`cross-thread.ts`** — new file `packages/vue/runtime/src/cross-thread.ts`:
  Stub for `runOnMainThread(fn)` — logs a warning that the SWC transform is needed. Scaffolds
  the callback registry for future async cross-thread returns.

- **MTS demo** — `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue` and
  `packages/vue/e2e-lynx/src/mts-demo/index.ts`:
  Hand-crafted worklet context objects that prove the ops plumbing works end-to-end. Look for
  `[vue-mt] SET_WORKLET_EVENT` in the Lynx console to verify.

**Limitation:** The worklet handler does not actually fire yet — that requires the worklet
runtime to be loaded on MT (Plan 04 Phase 2 below).

---

## Plan 05 — Vue runtime-dom Pipeline Tests 🔄 In Progress

**Goal:** Run Vue's `runtime-dom` upstream test suite through our full ops pipeline
(BG `patchProp` → ops buffer → `applyOps` → PAPI → JSDOM) to validate that `style`, `class`,
`id`, attributes, and events are all applied correctly to real DOM elements.

**Status:** Infrastructure files are written. Integration and triage not yet complete.

### What exists already

- `packages/vue/vue-upstream-tests/src/lynx-runtime-dom-bridge.ts` — the bridge module that
  intercepts `document.createElement` and `patchProp` calls from Vue runtime-dom tests and
  routes them through our ops pipeline synchronously.
- `packages/vue/vue-upstream-tests/src/runtime-dom-setup.ts` — Vitest setup file that boots
  `LynxTestingEnv`, wires MT and BG globals, and overrides `document.createElement`.
- `packages/vue/vue-upstream-tests/vitest.dom.config.ts` — second Vitest config targeting 5
  runtime-dom test suites: `patchStyle`, `patchClass`, `patchEvents`, `patchProps`, `patchAttrs`.

### What still needs to be done

1. **Run the tests and triage failures.**
   ```bash
   cd packages/vue/vue-upstream-tests
   pnpm run vuejs:init       # init submodule if not done
   pnpm run test:dom         # runs vitest.dom.config.ts
   ```
   The target is 50+ passing tests. Failures need to be added to
   `packages/vue/vue-upstream-tests/skiplist-dom.json` with a comment explaining why
   (e.g. `innerHTML` is not supported in Lynx, SVG namespaces don't apply).

2. **Fix gaps in ops-apply for boolean attributes.** Vue runtime-dom passes `disabled=""` for
   true and `null` for false. Confirm `packages/vue/main-thread/src/ops-apply.ts` handles
   `__SetAttribute(el, key, null)` correctly (removes the attribute).

3. **Add `test:dom` script** to `packages/vue/vue-upstream-tests/package.json`:
   ```json
   "test:dom": "vitest run --config vitest.dom.config.ts"
   ```

4. **Directive tests (optional Tier 2):** `patchStyle`, `patchClass`, `patchEvents` are
   self-contained. Directive tests (`vShow`, `vOn`) use the full `render()` API — if you want
   to add those, `packages/vue/vue-upstream-tests/src/lynx-runtime-dom-bridge.ts` needs to
   re-export a `render` function wired through the testing-library pipeline.

---

## Plan 04 Phase 2 — `<script main-thread>` Compile-Time Transform 🔜 Next Major Work

**Goal:** Users write Vue SFCs with a `<script main-thread>` block. The build pipeline
automatically extracts that block to the MT bundle and replaces function references in the
template with worklet context objects (`{ _wkltId, _c }`). No hand-crafting required.

This is the biggest remaining piece of work. It touches the build plugin, a new webpack loader,
and integration with the existing SWC worklet transform.

### Files to create

| File                                                                  | Purpose                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/vue/rspeedy-plugin/src/loaders/main-thread-block-loader.ts` | Webpack loader that handles `<script main-thread>` blocks in `.vue` files. On the BG pass: strips the block and emits worklet context objects for each exported function. On the MT pass: extracts the block content and runs the SWC LEPUS transform to produce `registerWorkletInternal(...)` calls. |
| `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue`                      | Update the existing demo to use real `<script main-thread>` syntax instead of hand-crafted context objects, once the loader works. (File exists at `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue` — edit it.)                                                                                        |

### Files to edit

| File                                                                    | Change needed                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/rspeedy-plugin/src/entry.ts`                              | Wire the `main-thread-block-loader` into the Rspack rule set. The MT layer (`vue:main-thread`) needs to run the LEPUS-target SWC transform; the BG layer needs to strip the block and inject worklet context objects. |
| `packages/vue/rspeedy-plugin/src/loaders/vue-main-thread-pre-loader.ts` | This pre-loader already handles `:main-thread-bindtap` prop rewriting. Extend it (or coordinate with the block loader) to inject the worklet context object imports that the block loader emits.                      |

### How it connects to existing infrastructure

The `@lynx-js/swc-plugin-reactlynx` SWC plugin already handles the worklet transform — it is
the same one React Lynx uses. Call it via `transformReactLynxSync()` from
`@lynx-js/react/transform` (napi binding). Pass `target: 'LEPUS'` for the MT output and
`target: 'JS'` for the BG output (which replaces the function with `{ _c, _wkltId }`).

Once the loader is working:

- The MTS demo at `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue` should work with real
  `<script main-thread>` syntax and the worklet should actually fire on tap (not just log).
- The scrolling demo at `packages/vue/e2e-lynx/src/scroll-demo/` exercises
  `:main-thread-bindscroll` which also needs this.

### Testing Plan 04 Phase 2

Add test files to `packages/vue/testing-library/src/__tests__/`:

| File to create                                                   | What to test                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/testing-library/src/__tests__/mts-worklet.test.ts` | A component with a hand-crafted worklet context bound via `:main-thread-bindtap`. Verify `SET_WORKLET_EVENT` op is emitted and `__AddEvent` is called with `{ type: 'worklet' }`. |
| `packages/vue/testing-library/src/__tests__/mts-ref.test.ts`     | A component with `:main-thread-ref`. Verify `SET_MT_REF` op is emitted with the correct `_wvid`.                                                                                  |

Full end-to-end worklet execution testing (the handler actually firing on MT) requires the
worklet runtime to be loaded in `LynxTestingEnv`, which is a larger setup task.

---

## Plan 04 Phase 3 — v-model via MT Worklets 🔜 Future

Depends on Phase 2 being complete. A pre-registered MT worklet handles `<input>` value sync:

1. User types → MT `bindinput` fires → worklet reads `getValue()` → calls `setValue()` immediately
   (no flicker) → dispatches `Lynx.Vue.inputUpdate` event to BG.
2. BG receives event → updates Vue `ref(value)` → reactive system → next tick re-render.

No files to create yet — design is in `packages/vue/.plans/04-main-thread-script.md`.

---

## Summary Table

| Plan       | Description                                    | Status         |
| ---------- | ---------------------------------------------- | -------------- |
| 00         | Vue Vine Lynx analysis                         | Reference doc  |
| 01         | Vue 3 Lynx compatibility research              | Reference doc  |
| 02         | Dual-Thread MVP                                | ✅ Done        |
| 03         | Testing infrastructure (E2E + upstream)        | ✅ Done        |
| 04 Phase 1 | MTS runtime foundation (ops, composable, demo) | ✅ Done        |
| 05         | runtime-dom pipeline tests                     | 🔄 In Progress |
| 04 Phase 2 | `<script main-thread>` compile-time transform  | 🔜 Next        |
| 04 Phase 3 | v-model via MT worklets                        | 🔜 Future      |
