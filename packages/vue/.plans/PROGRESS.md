# Vue Lynx Implementation — Progress & Next Steps

> **Status as of March 2026**
> Plans 02, 03, 04 Phase 1, 04 Phase 2, and 05 are all complete. All 30 testing-library tests
> pass. Tap events fire on the Main Thread with zero BG crossings. Next up: Plan 04 Phase 3
> (v-model via MT worklets).

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
`__AddEvent({ type: 'worklet', value: ctx })`. The worklet fires synchronously on MT with
zero thread crossings.

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

- **`MainThreadRef` composable** — `packages/vue/runtime/src/main-thread-ref.ts`:
  `useMainThreadRef(initialValue)` returns a ref whose `.value` lives on the MT side.
  Uses Vue's `.value` convention (not React's `.current`). Exported from
  `packages/vue/runtime/src/index.ts`.

- **`cross-thread.ts`** — `packages/vue/runtime/src/cross-thread.ts`:
  Stub for `runOnMainThread(fn)` — scaffolds the callback registry for future async
  cross-thread returns.

- **MTS demo** — `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue` and
  `packages/vue/e2e-lynx/src/mts-demo/index.ts`.

**Testing — ✅ Verified (March 2026):** Two test files added to `packages/vue/testing-library/src/__tests__/`:

- `mts-worklet.test.ts` (5 tests) — verifies `SET_WORKLET_EVENT` (op 11) is emitted with correct
  `eventType`/`eventName`/ctx, that `applyOps` calls `__AddEvent({ type: 'worklet', value: ctx })`,
  and that `fireEvent.tap` invokes `runWorklet` on MT (not `publishEvent` on BG).
- `mts-ref.test.ts` (5 tests) — verifies `SET_MT_REF` (op 12) is emitted, that `_wvid` matches
  the bound `MainThreadRef`, that `_initValue` is forwarded, and that multiple refs each get
  their own op with distinct `_wvid` values.

All 30 tests in `packages/vue/testing-library/` pass.

---

### Plan 05 — Vue runtime-dom Pipeline Tests ✅ Done

**Goal:** Run Vue's `runtime-dom` upstream test suite through our full ops pipeline
(BG `patchProp` → ops buffer → `applyOps` → PAPI → JSDOM) to validate that `style`, `class`,
`id`, attributes, and events are all applied correctly to real DOM elements.

**Status:** Complete. Tests run and triaged.

Key files:

- `packages/vue/vue-upstream-tests/src/lynx-runtime-dom-bridge.ts` — intercepts `patchProp`
  calls and routes them through the ops pipeline synchronously via a lazy shadow/jsdom mapping.
- `packages/vue/vue-upstream-tests/src/runtime-dom-setup.ts` — boots `LynxTestingEnv`, wires
  MT/BG globals; imports `ops-apply` from `dist/` to share the same `elements` Map instance as
  `@lynx-js/vue-main-thread`.
- `packages/vue/vue-upstream-tests/vitest.dom.config.ts` — runs 5 suites: `patchStyle`,
  `patchClass`, `patchEvents`, `patchProps`, `patchAttrs`.
- `packages/vue/vue-upstream-tests/skiplist-dom.json` — 44 tests permanently skipped with
  documented reasons (SVG, DOM properties, `innerHTML`, CSS features Lynx doesn't support).

Run with:

```bash
pnpm --filter @lynx-js/vue-upstream-tests run test:dom
```

---

### Plan 04 Phase 2 — `<script main-thread>` Compile-Time Transform ✅ Done

**Goal:** Users write Vue SFCs with a `<script main-thread>` block. The build pipeline
automatically extracts that block to the MT bundle and replaces function references in the
template with worklet context objects (`{ _wkltId, _c }`). No hand-crafting required.

**Status (March 2026):** Complete and verified on device. `MtsDemo.vue` builds correctly:
the BG bundle has `onTap = { _wkltId: "src/mts-demo/MtsDemo.vue:onTap", _c: {} }` injected
into `<script setup>`; the MT bundle calls
`registerWorkletInternal("main-thread", "src/mts-demo/MtsDemo.vue:onTap", onTap)`.
The `_wkltId` round-trip matches exactly. Tap events fire on the Main Thread with zero BG crossings.

**What was built:**

- `null-loader.ts` — silences `<template>` and `<script setup>` virtual modules on the MT layer.
- MT null-loader rule narrowed to `setup=true` only, so plain `<script>` worklet registrations
  are not silenced.
- `@lynx-js/react/worklet-runtime` and user `.vue` imports added to the MT entry so
  `registerWorkletInternal` is defined before registrations run.
- `VueMainThreadPlugin` changed from replacing to prepending the flat bundle, so the webpack
  startup still executes the worklet-runtime and registration modules.
- `vue-main-thread-pre-loader` forwards the `lang` attribute from `<script main-thread lang="ts">`
  to the emitted plain `<script>` so TypeScript compiles correctly on the MT layer.
- **Root cause of on-device failure:** `registerWorkletInternal(type, id, fn)` takes 3 arguments.
  The MT transform was only passing 2 (`id, fn`), which stored `_workletMap[fn] = undefined`
  instead of `_workletMap[id] = fn`. Fixed in `main-thread-block-loader.ts`.

**Transform data-flow:**

```
.vue source
  ↓ vue-main-thread-pre-loader (enforce: 'pre')
  ├── BG layer:
  │     → const onTap = { _wkltId: 'src/Foo.vue:onTap', _c: {} }
  │     injected into <script setup> → template binds :main-thread-bindtap="onTap"
  │     → SET_WORKLET_EVENT op sent to MT
  │
  └── MT layer:
        → function onTap(e) { ... }
          registerWorkletInternal('main-thread', 'src/Foo.vue:onTap', onTap)
        emitted as plain <script> → bundled alongside worklet-runtime
        VueMainThreadPlugin prepends flat bundle → full MT script ready
```

---

## Plan 04 Phase 3 — v-model via MT Worklets 🔜 Future

Depends on Phase 2 being complete. A pre-registered MT worklet handles `<input>` value sync:

1. User types → MT `bindinput` fires → worklet reads `getValue()` → calls `setValue()` immediately
   (no flicker) → dispatches `Lynx.Vue.inputUpdate` event to BG.
2. BG receives event → updates Vue `ref(value)` → reactive system → next tick re-render.

No files to create yet — design is in `packages/vue/.plans/04-main-thread-script.md`.

---

## Summary Table

| Plan       | Description                                    | Status        |
| ---------- | ---------------------------------------------- | ------------- |
| 00         | Vue Vine Lynx analysis                         | Reference doc |
| 01         | Vue 3 Lynx compatibility research              | Reference doc |
| 02         | Dual-Thread MVP                                | ✅ Done       |
| 03         | Testing infrastructure (E2E + upstream)        | ✅ Done       |
| 04 Phase 1 | MTS runtime foundation (ops, composable, demo) | ✅ Done       |
| 05         | runtime-dom pipeline tests                     | ✅ Done       |
| 04 Phase 2 | `<script main-thread>` compile-time transform  | ✅ Done       |
| 04 Phase 3 | v-model via MT worklets                        | 🔜 Future     |
