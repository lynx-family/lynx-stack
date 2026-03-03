# Vue Lynx Main Thread Script (MTS) Design Plan

## Scope

**This PR**: Design document + **Phase 1 runtime foundation** (new ops, patchProp detection, `MainThreadRef` composable, MT executor changes). No SWC build transform yet — Phase 1 tests with manually-constructed worklet context objects.

**Template syntax**: `:main-thread-bindscroll="onScroll"` (v-bind prefix, zero Vue compiler changes needed).

## Context

Vue Lynx currently routes ALL event handling through the Background Thread: native event → `publishEvent(sign, data)` on BG → Vue handler → reactive updates → ops buffer → `callLepusMethod` → Main Thread PAPI. This introduces 2 thread crossings per interaction, causing perceptible latency for gesture-driven animations and making `v-model` on `<input>` impossible (Lynx's `getValue()`/`setValue()` are synchronous, Main Thread-only APIs).

React Lynx solves this with **Main Thread Script**: functions marked with `'main thread'` directive execute synchronously on the Main Thread with zero thread crossings. We adapt this pattern for Vue, reusing Lynx's existing worklet infrastructure.

## Architecture Overview

```
BUILD TIME                                          RUNTIME
─────────────────────────────────────────────────────────────────────────────
.vue file                                           BG Thread
  │                                                 ┌─────────────────────┐
  ├─ <script setup>  → BG bundle (vue-loader)       │ Vue renderer        │
  │                                                 │ patchProp detects   │
  ├─ <script main-thread>  → MT bundle              │ "main-thread-bind*" │
  │  (compiled for Lepus, registered via             │ → pushOp(SET_WORK-  │
  │   registerWorkletInternal)                       │   LET_EVENT, ctx)   │
  │                                                 │ → callLepusMethod   │
  └─ webpack bundles                                └────────┬────────────┘
     ├─ BG: Vue + user code (worklet context objs)           │
     └─ MT: PAPI executor + worklet-runtime                  ▼
           + registerWorkletInternal calls            MT Thread
                                                    ┌─────────────────────┐
                                                    │ applyOps receives   │
                                                    │ SET_WORKLET_EVENT   │
                                                    │ → __AddEvent(el,    │
                                                    │   type, name,       │
                                                    │   {type:'worklet',  │
                                                    │    value: ctx})     │
                                                    │                     │
                                                    │ User taps element:  │
                                                    │ → runWorklet(ctx,   │
                                                    │   [event]) — ZERO   │
                                                    │   thread crossings  │
                                                    └─────────────────────┘
```

## User-Facing API

### SFC Syntax: `<script main-thread>`

Main-thread functions live in a **separate `<script>` block** — Vue-idiomatic, clean separation:

```vue
<script setup>
import { ref } from 'vue';
import { useMainThreadRef } from '@lynx-js/vue-runtime';

const count = ref(0);
const elRef = useMainThreadRef(null);
</script>

<script main-thread>
// This entire block compiles for the Main Thread.
// Exports become worklet context objects available in the template.
export function onScroll(event) {
  event.currentTarget.setStyleProperty('opacity', '0.5');
}

export function onTap(event) {
  event.currentTarget.setStyleProperty('background-color', 'blue');
}
</script>

<template>
  <scroll-view
    :main-thread-ref="elRef"
    :main-thread-bindscroll="onScroll"
    :main-thread-bindtap="onTap"
    :style="{ width: 300, height: 300 }"
  >
    <text>Scroll me</text>
  </scroll-view>
</template>
```

**Why `<script main-thread>` instead of React's `'main thread'` directive?**

- Vue already supports multiple `<script>` blocks (`<script>` + `<script setup>`)
- Clean separation: BG logic in `<script setup>`, MT handlers in `<script main-thread>`
- No SWC closure extraction needed — the block boundary IS the thread separation
- vue-loader custom block handling can route the block to the MT bundle directly
- `event.currentTarget` provides element access; `useMainThreadRef` bridges shared state

### Template Binding Syntax (v-bind prefix)

```vue
<!-- Use :main-thread- prefix to bind worklet events/refs -->
<view :main-thread-bindtap="onTap" :main-thread-ref="elRef" />
```

Vue's `:` (v-bind) evaluates the expression and passes the JS value to `patchProp`. The `main-thread-` prefix is detected at runtime — zero Vue compiler changes needed.

### Cross-Thread References

**Option A: `useMainThreadRef` (explicit, general-purpose)**

```typescript
import { useMainThreadRef } from '@lynx-js/vue-runtime';

// Element reference
const elRef = useMainThreadRef<ViewElement>(null);
// <view :main-thread-ref="elRef" />

// In <script main-thread>:
elRef.value?.setStyleProperty('transform', '...'); // .value access (Vue convention)

// General MT state (not just elements)
const scrollY = useMainThreadRef(0);
// In <script main-thread>:
scrollY.value = event.detail.scrollTop; // writable on MT
```

**Option B: `useMainThreadHandle` (derived from template ref, future Phase 2)**

```typescript
import { useTemplateRef } from 'vue';
import { useMainThreadHandle } from '@lynx-js/vue-runtime';

const el = useTemplateRef<ShadowElement>('myEl');
const elHandle = useMainThreadHandle(el); // auto-derives from template ref
// <view ref="myEl" />  — standard Vue ref binding

// In <script main-thread>:
elHandle.value?.setStyleProperty('color', 'red');
```

Option A is Phase 1 (general-purpose). Option B layers on top later by resolving the ShadowElement id → PAPI element mapping on MT.

### Other Composable APIs (future)

```typescript
// runOnMainThread — async BG → MT invocation (future Phase 2)
const result = await runOnMainThread(fn)(arg1, arg2);

// runOnBackground — async MT → BG invocation (future Phase 2)
await runOnBackground(() => {
  count.value++;
})();
```

## Compile-Time Transform (Phase 2 — not this PR)

### Two approaches considered:

**A. `<script main-thread>` block** (Vue-idiomatic, recommended)

- vue-loader custom block handler routes the block to MT bundle
- Exports from the block are mapped to worklet context objects on BG side
- No SWC closure extraction needed

**B. `'main thread'` directive** (React Lynx compatible, fallback)

- Reuse `@lynx-js/swc-plugin-reactlynx` worklet visitor on vue-loader JS output
- `target: 'JS'` for BG (replaces fn with `{ _c, _wkltId }`), `target: 'LEPUS'` for MT (emits `registerWorkletInternal`)
- Callable via `transformReactLynxSync()` from `@lynx-js/react/transform` (napi binding)

### Build Pipeline Change (Phase 2)

**Current**: MT bundle = ONLY `entry-main.ts` (PAPI executor, no user code)

**New**: MT bundle = `entry-main.ts` + `worklet-runtime` + `<script main-thread>` blocks (or LEPUS-transformed user code)

## Runtime Changes

### New Op Codes (`packages/vue/runtime/src/ops.ts`)

```typescript
export const OP = {
  // ... existing 0-10 ...
  SET_WORKLET_EVENT: 11, // [11, id, eventType, eventName, workletCtx]
  SET_MT_REF: 12, // [12, id, { _wvid }]
} as const;
```

### patchProp Extension (`packages/vue/runtime/src/node-ops.ts`)

```typescript
// Detect main-thread-* props (added before existing event/style/class checks):
if (key.startsWith('main-thread-')) {
  const suffix = key.slice('main-thread-'.length);
  if (suffix === 'ref') {
    pushOp(OP.SET_MT_REF, el.id, (nextValue as MainThreadRef).toJSON());
  } else {
    const event = parseEventProp(suffix);
    if (event && nextValue) {
      pushOp(OP.SET_WORKLET_EVENT, el.id, event.type, event.name, nextValue);
    }
  }
  scheduleFlush();
  return;
}
```

### Main Thread Executor (`packages/vue/main-thread/src/ops-apply.ts`)

```typescript
case OP.SET_WORKLET_EVENT: {
  const id = ops[i++], eventType = ops[i++], eventName = ops[i++], ctx = ops[i++]
  const el = elements.get(id)
  if (el) __AddEvent(el, eventType, eventName, { type: 'worklet', value: ctx })
  break
}

case OP.SET_MT_REF: {
  const id = ops[i++], refImpl = ops[i++]
  const el = elements.get(id)
  // Store in worklet ref map if worklet-runtime is loaded
  if (el && typeof lynxWorkletImpl !== 'undefined') {
    lynxWorkletImpl._refImpl?.updateWorkletRef(refImpl, el)
  }
  break
}
```

### v-model Mechanism (Phase 3 — not this PR)

Pre-registered MT worklet handles synchronous input value sync:

```
User types → MT bindinput fires → MT worklet reads getValue()
  → MT: setValue() (immediate visual feedback, no flicker)
  → MT: dispatchEvent('Lynx.Vue.inputUpdate', { elementId, value }) to BG
  → BG: updates Vue ref(value) → reactive system → next tick
```

## Files to Create/Modify (Phase 1)

### New Files

| File                                          | Purpose                                                |
| --------------------------------------------- | ------------------------------------------------------ |
| `packages/vue/runtime/src/main-thread-ref.ts` | `MainThreadRef` class, `useMainThreadRef()` composable |
| `packages/vue/runtime/src/cross-thread.ts`    | `runOnMainThread()` stub, callback registry            |
| `packages/vue/e2e-lynx/src/mts-demo/index.ts` | Phase 1 E2E demo with hand-crafted worklet context     |

### Modified Files

| File                                        | Change                                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| `packages/vue/runtime/src/ops.ts`           | Add `SET_WORKLET_EVENT=11`, `SET_MT_REF=12`                   |
| `packages/vue/runtime/src/node-ops.ts`      | Detect `main-thread-*` props in `patchProp`                   |
| `packages/vue/runtime/src/index.ts`         | Export `useMainThreadRef`, `MainThreadRef`, `runOnMainThread` |
| `packages/vue/main-thread/src/ops-apply.ts` | Handle new op codes                                           |

### Reused from React Lynx (future phases, no modification)

| Package                          | What                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `@lynx-js/react/transform`       | SWC worklet transform (napi)                                                  |
| `@lynx-js/react/worklet-runtime` | `initWorklet()`, `registerWorkletInternal()`, `runWorklet()`, `Element` class |

## Implementation Steps (Phase 1)

### Step 1: New Op Codes

**File**: `packages/vue/runtime/src/ops.ts`

- Add `SET_WORKLET_EVENT = 11` and `SET_MT_REF = 12`

### Step 2: MainThreadRef Composable

**File (new)**: `packages/vue/runtime/src/main-thread-ref.ts`

- `MainThreadRef<T>` class: `_wvid`, `_initValue`, `toJSON()`, `.value` getter/setter (throws on BG in dev)
- Uses `.value` (Vue convention) instead of `.current` (React convention)
- `useMainThreadRef<T>(initValue)` with `onScopeDispose` cleanup
- Compatible with worklet-runtime's `_wvid`-based ref resolution on MT

### Step 3: patchProp Detection

**File**: `packages/vue/runtime/src/node-ops.ts`

- Detect `main-thread-*` prefix, parse suffix, emit `SET_WORKLET_EVENT` or `SET_MT_REF` ops

### Step 4: Main Thread Executor

**File**: `packages/vue/main-thread/src/ops-apply.ts`

- Handle `SET_WORKLET_EVENT`: `__AddEvent(el, type, name, { type: 'worklet', value: ctx })`
- Handle `SET_MT_REF`: store in worklet ref map (if available)

### Step 5: Cross-Thread Stubs

**File (new)**: `packages/vue/runtime/src/cross-thread.ts`

- `runOnMainThread(fn)` stub (logs warning that SWC transform needed)
- Callback registry scaffold for future async returns

### Step 6: Exports

**File**: `packages/vue/runtime/src/index.ts`

- Export new APIs

### Step 7: E2E Demo

**File (new)**: `packages/vue/e2e-lynx/src/mts-demo/`

- Hand-crafted worklet context object (simulates what compiler would produce)
- Tests the full ops plumbing: BG → ops → MT → `__AddEvent` with worklet context

## Testing Strategy (Phase 1)

Since Phase 1 has no SWC transform, we test the **runtime plumbing** only:

1. **Build check**: `pnpm build` in all three packages — existing counter/todomvc demos still work
2. **Type check**: `pnpm tsc --noEmit` passes across runtime, main-thread, rspeedy-plugin
3. **Ops flow test**: The mts-demo emits `SET_WORKLET_EVENT` ops. On MT, verify via `console.info` logs that `__AddEvent` is called with `{ type: 'worklet', value: { _wkltId: '...' } }`
4. **No regression**: Existing BG-thread events (`@tap`, `@confirm`) continue to work normally via sign-based registry
5. **DevTool verification**: `Runtime_listConsole` on LynxExplorer shows the worklet event binding logs

**Note**: The worklet handler won't actually fire yet (no worklet-runtime on MT). That requires Phase 2. Phase 1 proves the plumbing is correct.
