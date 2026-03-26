# Vue Lynx Implementation — Progress & Next Steps

> **Status as of March 2026**
> Plans 02, 03, 04 Phase 1, and 05 are all complete. All 30 testing-library tests pass
> (including the new MTS worklet and ref tests). The remaining large body of work is Plan 04
> Phase 2: the compile-time `<script main-thread>` block transform.

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

**Testing — ✅ Verified (March 2026):** Two test files added to `packages/vue/testing-library/src/__tests__/`:

- `mts-worklet.test.ts` (5 tests) — verifies `SET_WORKLET_EVENT` (op 11) is emitted with correct
  `eventType`/`eventName`/ctx, that `applyOps` calls `__AddEvent({ type: 'worklet', value: ctx })`,
  and that `fireEvent.tap` invokes `runWorklet` on MT (not `publishEvent` on BG).
- `mts-ref.test.ts` (5 tests) — verifies `SET_MT_REF` (op 12) is emitted, that `_wvid` matches
  the bound `MainThreadRef`, that `_initValue` is forwarded, and that multiple refs each get
  their own op with distinct `_wvid` values.

All 30 tests in `packages/vue/testing-library/` pass.

---

## Plan 05 — Vue runtime-dom Pipeline Tests ✅ Done

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

## Plan 04 Phase 2 — `<script main-thread>` Compile-Time Transform ✅ Done

**Goal:** Users write Vue SFCs with a `<script main-thread>` block. The build pipeline
automatically extracts that block to the MT bundle and replaces function references in the
template with worklet context objects (`{ _wkltId, _c }`). No hand-crafting required.

**Status (March 2026):** Complete. The compile-time transform is end-to-end working.
`MtsDemo.vue` builds correctly: BG bundle has `onTap = { _wkltId: "src/mts-demo/MtsDemo.vue:onTap", _c: {} }`
injected into `<script setup>`; MT bundle has `registerWorkletInternal('main-thread', "src/mts-demo/MtsDemo.vue:onTap", onTap)`.
The `_wkltId` round-trip matches exactly. Tap events now fire on the Main Thread with zero BG crossings.

**Key fix:** With `experimentalInlineMatchResource: true`, vue-loader re-runs loaders on virtual
module requests using the original file from disk — bypassing the initial full-file transform.
The pre-loader now re-applies the transformation for:

- BG + `?vue&type=script&setup=true` → injects worklet context objects into `<script setup>`
- MT + `?vue&type=script` (no setup) → returns flat `<script lang="ts">` with registration calls

**Current state (before fix):** More infrastructure existed than the original plan assumed, but there were 5 specific gaps preventing end-to-end execution.

### What already exists

| File                                                                    | Status                                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/vue/rspeedy-plugin/src/loaders/main-thread-block-loader.ts`   | ✅ Exists — JS BG/MT transform (regex-based, not real SWC yet); BG emits `{ _wkltId, _c: {} }` (correct)  |
| `packages/vue/rspeedy-plugin/src/loaders/vue-main-thread-pre-loader.ts` | ✅ Exists — pre-loader that finds block, injects into `<script setup>` (BG) or emits flat `<script>` (MT) |
| `packages/vue/rspeedy-plugin/src/entry.ts` — loader rules               | ✅ BG and MT pre-loader rules wired                                                                       |
| `packages/vue/rspeedy-plugin/src/entry.ts` — `VueMainThreadPlugin`      | ✅ Prepends flat bundle (`flatCode + '\n' + existingCode`) so user registrations run after runtime        |
| `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue`                        | ✅ Already uses `<script main-thread>` syntax                                                             |

---

### Step 1 — Create `null-loader.ts` (blocking — build crashes without it)

**Create:** `packages/vue/rspeedy-plugin/src/loaders/null-loader.ts`

`entry.ts` line 189 references `./loaders/null-loader` to silence `<template>` and
`<script setup>` virtual modules on the MT layer, but this file does not exist. Build
would crash immediately with a loader resolution error. One-liner fix:

```ts
export default function nullLoader() {
  return '';
}
```

---

### Step 2 — Narrow the MT script null-loader rule

**Edit:** `packages/vue/rspeedy-plugin/src/entry.ts` (~line 224)

The current rule silences every `type=script` virtual module on the MT layer:

```ts
.resourceQuery(/\btype=script\b/)   // too broad
```

The MT pre-loader emits worklet registrations in a **plain** `<script>` (no `setup` attribute).
This regex would null-load those registrations before they run. Only `<script setup>` virtual
modules should be silenced. Narrow the match:

```ts
.resourceQuery(/\btype=script\b[^&]*&setup=true|\bsetup=true\b[^&]*&type=script/)
```

---

### Step 3 — Add user imports + worklet runtime to the MT entry

**Edit:** `packages/vue/rspeedy-plugin/src/entry.ts` (~lines 281–289, MT entry `add()` call)

Currently the MT entry only contains `@lynx-js/vue-main-thread`. User `.vue` files are
never in the MT dependency graph, so the pre-loader never runs on them and no
`registerWorkletInternal(...)` calls are bundled. Change to:

```ts
import: [
  require.resolve('@lynx-js/react/worklet-runtime'), // must run before registrations
  ...imports,                                         // user .vue → registerWorkletInternal calls
  require.resolve('@lynx-js/vue-main-thread'),        // renderPage, vuePatchUpdate
]
```

The worklet runtime must come first so `registerWorkletInternal` is defined when the
user code runs.

---

### Step 4 — Debug and verify on device

**Verify:** `packages/vue/e2e-lynx/src/mts-demo/MtsDemo.vue`

The worklet tap has been intermittently unreliable — sometimes fires, sometimes silently does
nothing. The failure mode is almost always one of three root causes, each with a distinct
console signature. Work through the checkpoints in order.

---

#### Checkpoints

**Checkpoint A — BG compile: is `_wkltId` what you expect?**

Inside the component `setup()`, log the worklet context object before it reaches the template:

```vue
<script setup>
// ...imported from <script main-thread> by the pre-loader...
console.log('[mts-debug] A onTap ctx =', JSON.stringify(onTap));
</script>
```

Expected output: `[mts-debug] A onTap ctx = {"_wkltId":"src/mts-demo/MtsDemo.vue:onTap","_c":{}}`

The `_wkltId` must be a **relative path from the project root**, not an absolute path
(`/Users/kealan/...`). Absolute paths are the #1 cause of registration mismatches — the
same file produces a different path string in CI, on another machine, or in a production
build where path prefixes are stripped. The loader needs to compute `filename` as
`path.relative(process.cwd(), this.resourcePath)`. Check
`packages/vue/rspeedy-plugin/src/loaders/main-thread-block-loader.ts` `transformToBg` and
`transformToMt` — both use the `filename` argument passed by the pre-loader. Check what
`packages/vue/rspeedy-plugin/src/loaders/vue-main-thread-pre-loader.ts` passes as `filename`.
If it passes `this.resourcePath` (absolute), change it to
`path.relative(this.rootContext, this.resourcePath)`.

---

**Checkpoint B — MT bundle: is `registerWorkletInternal` defined when registrations run?**

Add a guard log at the very start of the MT transform output. Edit `transformToMt` in
`packages/vue/rspeedy-plugin/src/loaders/main-thread-block-loader.ts` to prepend a check:

```ts
const guard = `if (typeof registerWorkletInternal === 'undefined') {
  console.error('[mts-debug] B registerWorkletInternal MISSING — worklet-runtime not loaded yet');
} else {
  console.log('[mts-debug] B registerWorkletInternal OK');
}`;
return guard + '\n'
  + (registrations ? `${stripped}\n${registrations}` : stripped);
```

If you see the `MISSING` log, the worklet runtime chunk is not loaded before the user
registrations execute. Fix the MT entry import order (Step 4) or ensure Lynx loads the
worklet-runtime chunk before calling the MT bundle.

---

**Checkpoint C — MT ops-apply: does `SET_WORKLET_EVENT` show `el found= true`?**

The existing `[vue-mt] SET_WORKLET_EVENT` log already includes `el found=`. Watch for
`el found= false` — this means `elements.get(id)` returned `undefined`. The element was
never created on MT, which means the `CREATE` op for that element either was not in the ops
array or failed silently.

If you see this, log the full raw ops array in `applyOps` at the top of the function in
`packages/vue/main-thread/src/ops-apply.ts`:

```ts
if (__DEV__) {
  console.log('[mts-debug] C applyOps full ops:', JSON.stringify(ops));
}
```

Compare element id in `SET_WORKLET_EVENT` (op 11) against element id in the preceding
`CREATE` op (op 0). They must match.

---

**Checkpoint D — `_wkltId` round-trip match**

The `_wkltId` in the `SET_WORKLET_EVENT` ctx object (from BG) must exactly equal the
first argument passed to `registerWorkletInternal` on MT. Add a log to `applyOps` at the
SET_WORKLET_EVENT case in `packages/vue/main-thread/src/ops-apply.ts` (already has one —
extend it to also print `ctx._wkltId`):

```ts
console.log(
  '[mts-debug] D wkltId in ctx:',
  (ctx as { _wkltId?: string })?._wkltId,
);
```

Then add a matching log in the MT-transform output:

```ts
// in transformToMt:
const registrations = names.map((name) => {
  const id = `${filename}:${name}`;
  return `console.log('[mts-debug] D registering:', ${JSON.stringify(id)});\n`
    + `registerWorkletInternal(${JSON.stringify(id)}, ${name});`;
}).join('\n');
```

The two values printed by checkpoint D **must be byte-for-byte identical**. A mismatch here
is why the worklet fires nothing silently.

---

**Checkpoint E — worklet runtime: does `runWorklet` fire?**

If A–D all look correct but the tap still does nothing, the worklet runtime received the
`__AddEvent` call but is not firing `runWorklet`. Wrap the handler body with a log:

```ts
// <script main-thread>
export function onTap(event) {
  console.log('[mts-debug] E onTap FIRED, target:', event?.currentTarget);
  event.currentTarget.setStyleProperty('opacity', '0.6');
}
```

If `E onTap FIRED` does not appear after a tap, the event binding on the element is wrong.
Check what Lynx DevTools shows for the element's event listeners. The `type: 'worklet'`
handler structure `{ type: 'worklet', value: { _wkltId, _c } }` is what Lynx's worklet
runtime expects — if the runtime version doesn't match, the shape may differ.

---

**Checkpoint F — re-render overwrites: does a second render break the binding?**

If the tap works on first render but breaks after any reactive update, a re-render is
sending a new `SET_WORKLET_EVENT` with a stale `_c`. With `_c: {}` this should be harmless,
but a re-render that removes and re-creates the element (e.g. a `v-if` toggle) will also
send a `CREATE` for a new element id, while the old element (with the registered worklet)
is removed. Log `REMOVE` ops (op 3) in `applyOps` and compare element ids to confirm the
element is being recreated rather than patched.

---

#### Quick diagnostic flow

```
tap fires nothing
  ↓
check A: is _wkltId a relative path?   NO → fix loader filename arg (relative, not absolute)
  ↓
check B: is registerWorkletInternal defined?  NO → fix MT entry import order (worklet-runtime first)
  ↓
check C: is el found= true?   NO → log full ops, check CREATE op for that element id
  ↓
check D: do both _wkltId strings match exactly?  NO → align filename computation in BG and MT transforms
  ↓
check E: does 'onTap FIRED' appear?   NO → Lynx worklet runtime version mismatch, inspect DevTools
  ↓
check F: does it break only after re-render?  YES → element is being recreated (v-if), check REMOVE ops
```

---

#### Build and run

```bash
pnpm --filter @lynx-js/e2e-lynx build
```

Watch the Lynx DevTools console. A clean run with no issues prints in order:

1. `[mts-debug] B registerWorkletInternal OK`
2. `[vue-mt] SET_WORKLET_EVENT id=… ctx=… el found= true`
3. `[mts-debug] D wkltId in ctx: src/mts-demo/MtsDemo.vue:onTap`
4. `[mts-debug] D registering: src/mts-demo/MtsDemo.vue:onTap`
5. `[mts-debug] E onTap FIRED` (on first tap)

---

### Step 5 — Loader transform unit test (optional but recommended)

**Create:** `packages/vue/rspeedy-plugin/src/__tests__/main-thread-block-loader.test.ts`

Test the JS transform in isolation — no webpack required:

- BG mode: `export function onTap(e) {}` → `const onTap = { _wkltId: '…:onTap', _c: {} };`
- MT mode: `export function onTap(e) {}` → `function onTap(e) {}\nregisterWorkletInternal('…:onTap', onTap);`

---

### Transform data-flow summary

```
.vue source
  ↓ vue-main-thread-pre-loader (enforce: 'pre')
  ├── BG layer:
  │     runSwcTransform(block, 'BG')
  │     → const onTap = { _wkltId: 'src/Foo.vue:onTap', _c: {} }
  │     injected into <script setup> → template sees onTap as worklet ctx object
  │     → :main-thread-bindtap="onTap" sends SET_WORKLET_EVENT op (already works)
  │
  └── MT layer:
        runSwcTransform(block, 'MT')
        → function onTap(e) { ... }
          registerWorkletInternal('src/Foo.vue:onTap', onTap)
        emitted as plain <script> → NOT silenced after Step 3 fix
        webpack bundles into MT asset alongside worklet-runtime
        VueMainThreadPlugin prepends flat bundle → full MT script ready
```

### Testing

- Step 5 unit test covers transform correctness in isolation
- Step 4 device test covers the full pipeline end-to-end
- Full worklet body execution in `LynxTestingEnv` requires loading `@lynx-js/react/worklet-runtime`
  in the test setup — tracked as a future task

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
| 04 Phase 2 | `<script main-thread>` compile-time transform  | 🔜 Next       |
| 04 Phase 3 | v-model via MT worklets                        | 🔜 Future     |

Still failing

TypeError: not a function on tap — main-thread.js: with no line info, from quick_context.cc(981).

The built main-thread.js verifiably contains the minimal worklet IIFE and registration calls, so the JS is structurally correct. But something at the C++↔Lepus boundary is failing.

---

Key unknown: what Lynx actually calls for worklet events

We assumed Lynx calls globalThis.runWorklet(ctx, params) where ctx = { _wkltId: '...', _c: {} }. This is based on the React worklet-runtime interface. We don't have confirmation this
is correct for the Vue path.

Possibilities:

1. Lynx calls globalThis.runWorklet(storedHandler, params) where storedHandler is the raw object passed to __AddEvent — i.e., our { type: 'worklet', value: ctx } wrapper. Then
   ctx._wkltId in our stub is undefined.
2. Lynx tries to call the stored handler directly as a function → { type: 'worklet', value: ctx }(params) → TypeError: not a function.
3. runWorklet is never being set (the IIFE silently fails before setting it).
4. Lepus console.log from MT is silently failing and the stub IS working but something inside onTap throws.

---

Better debugging approach for next session

1. Use intentional errors instead of console.log

Lepus console output is invisible in Console.app. Throw errors instead — they surface as the main-thread.js exception: messages we CAN see:

// In the minimal worklet stub in entry.ts/dist/index.js:
globalThis.runWorklet = function(ctx, params) {
throw new Error('runWorklet ctx=' + JSON.stringify(ctx));
};

After a tap you'd see the error message in Console.app showing exactly what ctx Lynx passes. This immediately answers: is runWorklet called at all? And what shape is ctx?

Similarly for registration:
globalThis.registerWorkletInternal = function(type, id, fn) {
throw new Error('registerWorkletInternal id=' + id + ' fn=' + typeof fn);
};

2. Try passing ctx directly to __AddEvent

In ops-apply.ts, change:
__AddEvent(el, eventType, eventName, {
type: 'worklet',
value: ctx,
});
to:
__AddEvent(el, eventType, eventName, ctx);

The { type: 'worklet', value: ctx } wrapper is a Vue invention — Lynx's C++ may not unwrap it before calling runWorklet, meaning it passes the whole wrapper object instead of ctx,
causing ctx._wkltId to be undefined in our stub. Or Lynx might call the handler directly as a function.

3. Check the React Lynx main-thread source

Look at how @lynx-js/react registers worklet events on the main thread. The SWC plugin output for a React component with main-thread:bindtap would show the exact __AddEvent call
format Lynx expects. The file to look at: packages/react/ — find the MT bundle or the SWC plugin output for worklet event registration.

4. Inspect __AddEvent signature in the Lepus headers

Search the repo for __AddEvent declaration or usage in C++/Obj-C to see what the 4th argument type actually is.

grep -r "__AddEvent" packages/ --include="_.ts" --include="_.js" -l

---

The smoking gun will be answer to: does runWorklet get called, and with what ctx? The throw-error approach will reveal this in one build cycle.
