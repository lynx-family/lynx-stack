# MTC Implementation — Stacked PR Plan

## Context

PR #1530 proved MTC (Main Thread Component) works but is unshippable due to deep coupling. The [architecture redesign](packages/react/docs/design-mtc-architecture.md) on branch `design/mtc-architecture` defines the target: decoupled, opt-in MTC built on existing infrastructure. This plan splits that architecture into 6 stacked PRs, each independently testable and incrementally useful.

**Dependency graph:**

```
PR 1 (Patch Registry) ──→ PR 3 (mtc-runtime) ──→ PR 5 (Webpack) ──→ PR 6 (E2E)
PR 2 (Background Worklet) ──→ PR 4 (Compile) ──↗
```

---

## PR 1: Extensible Patch Handler Registry

**Goal**: Make `snapshotPatchApply` extensible so external modules can register custom patch operation handlers without modifying the core switch.

**Files**:

- `packages/react/runtime/src/lifecycle/patch/patchHandlerRegistry.ts` — **NEW**
- `packages/react/runtime/src/lifecycle/patch/snapshotPatchApply.ts` — add `default` case

**Changes**:

1. New `patchHandlerRegistry.ts`:

```typescript
type PatchHandler = (patch: SnapshotPatch, i: number) => number;
const registry = new Map<number, PatchHandler>();
export function registerPatchHandler(op: number, handler: PatchHandler): () => void { ... }
export { registry as patchHandlerRegistry };
```

2. In `snapshotPatchApply.ts` switch, add after the `DEV_ONLY_SetSnapshotEntryName` case:

```typescript
default: {
  const handler = patchHandlerRegistry.get(snapshotPatch[i] as number);
  if (handler) {
    i = handler(snapshotPatch, i);
  } else if (__DEV__) {
    console.warn('[ReactLynx] Unknown snapshot operation:', snapshotPatch[i]);
  }
  break;
}
```

**Tests**: `runtime/__test__/lifecycle/patchHandlerRegistry.test.ts`

- Register handler for custom op `99`, construct patch `[99, 'arg1', 'arg2']`, apply, verify handler called
- Unregister handler, apply same patch, verify warning in dev mode
- Multiple handlers for different ops coexist

**Independent value**: Generic extension point for any future patch-based feature. Not MTC-specific.

---

## PR 2: `'background'` Worklet Type

**Goal**: Add a `Background` worklet type so functions with `'use background'` directive compile to worklet ctx objects, enabling main-thread → background-thread calls via existing `runOnBackground()`.

**Files**:

- `transform/crates/swc_plugin_worklet/worklet_type.rs` — add `Background` variant

**Changes**:

```rust
pub enum WorkletType {
  Element,     // "main thread" / "main-thread"
  UI,          // "use worklet"
  Background,  // "use background" / "background"  (NEW)
}

impl WorkletType {
  pub fn from_directive(directive: String) -> Option<WorkletType> {
    // ... existing ...
    } else if directive == "use background" || directive == "background" {
      Some(WorkletType::Background)
    } else {
      None
    }
  }
  pub fn type_str(&self) -> &str {
    match self {
      // ... existing ...
      WorkletType::Background => "background",
    }
  }
}
```

May also need minor changes in:

- `swc_plugin_worklet/gen_stmt.rs` — handle `Background` in registration (for LEPUS target: keep body; for JS target: emit `registerWorklet("background", hash, fn)`)
- `swc_plugin_worklet/lib.rs` — ensure `Background` passes through extraction pipeline

**Tests**: SWC transform fixture tests

- Input: `function handler() { 'use background'; fetchData(); }` on JS target → verify `registerWorklet("background", ...)` emitted
- Input: same on LEPUS target → verify function body preserved as-is
- Verify closure variable extraction works (reuses existing ExtractingIdentsCollector)

**Independent value**: Enables `'use background'` directive in any main-thread function. Background functions work via existing `runOnBackground()` — no new cross-thread protocol needed. Useful beyond MTC.

---

## PR 3: `@lynx-js/react-mtc-runtime` Package

**Goal**: Create the MTC runtime package that registers patch handlers for MTC mount/update/unmount, renders Preact islands on the main thread, adopts BTC slot children, and manages lifecycle cleanup.

**Files**:

- `packages/react/mtc-runtime/` — **NEW directory** (follow worklet-runtime pattern)
  - `package.json` — `"name": "@lynx-js/react-mtc-runtime"`, private
  - `rslib.config.ts` — IIFE build (dev + main), ES2019 syntax
  - `tsconfig.json`, `vitest.config.ts`
  - `src/index.ts` — entry: guards against double-init, calls `initMtcRuntime()`, defines `globalThis.registerMTC`
  - `src/mtcRuntime.ts` — `initMtcRuntime()`, handler registration
  - `src/renderer.ts` — Preact `render()`/`render(null)` for MTC islands
  - `src/slot.ts` — slot child adoption via `snapshotInstanceManager.values.get(id)` + `__AppendElement()`
  - `src/errorBoundary.ts` — Preact error boundary component per MTC island
  - `src/types.ts` — `MTCComponentDef`, `MTCInstance` interfaces
- `packages/react/runtime/src/lifecycle/patch/snapshotPatch.ts` — add MTC op codes
- `packages/react/package.json` — add `./mtc-runtime` and `./mtc-dev-runtime` exports
- `pnpm-workspace.yaml` — may need update (check if `packages/react/*` already covers it)

**Key runtime flow** (inside `mtcRuntime.ts`):

```typescript
import { registerPatchHandler } from '@lynx-js/react/runtime'; // from PR 1

const componentRegistry = new Map<string, ComponentFactory>();
const instanceMap = new Map<number, MTCInstance>();

export function initMtcRuntime(): void {
  const unreg1 = registerPatchHandler(SnapshotOperation.MtcMount, handleMount);
  const unreg2 = registerPatchHandler(
    SnapshotOperation.MtcUpdate,
    handleUpdate,
  );
  const unreg3 = registerPatchHandler(
    SnapshotOperation.MtcUnmount,
    handleUnmount,
  );

  // Register cleanup via existing destroyTasks
  destroyTasks.push(() => {
    for (const [, inst] of instanceMap) inst.cleanup();
    instanceMap.clear();
    unreg1();
    unreg2();
    unreg3();
  });
}
```

**MTC op codes** added to `snapshotPatch.ts`:

```typescript
export const SnapshotOperation = {
  // ... existing 0-4, 100-102 ...
  MtcMount: 10, // params: [snapshotInstanceId, componentHash, propsValues]
  MtcUpdate: 11, // params: [snapshotInstanceId, propsValues]
  MtcUnmount: 12, // params: [snapshotInstanceId]
} as const;
```

**Slot adoption** (in `slot.ts`):

- `MtcMount` handler reads slot element IDs from props
- Looks them up in `snapshotInstanceManager.values`
- Adopts via `__AppendElement()` — synchronous, no microtask hack
- BTC child updates arrive as normal `SetAttribute` patches (no MTC re-render needed for slot updates)

**Existing utilities to reuse**:

- `destroyTasks` from `runtime/src/lifecycle/patch/commit.ts` (cleanup registration)
- `snapshotInstanceManager` from `runtime/src/snapshot.ts` (slot element lookup)
- `registerPatchHandler` from PR 1

**Tests**: `mtc-runtime/__test__/`

- `renderer.test.ts` — mount component, verify Preact `render()` called; update props, verify re-render; unmount, verify `render(null)`
- `slot.test.ts` — construct patch with slot child IDs, verify elements adopted via `__AppendElement()`
- `errorBoundary.test.ts` — component throws, verify error caught and reported, other islands unaffected
- `lifecycle.test.ts` — page destroy triggers cleanup, verify all instances cleaned up

**Independent value**: Functional MTC rendering engine. Developers can manually construct MTC patches (e.g., in tests or prototypes) and have Preact render on the main thread without needing compile support.

---

## PR 4: MTC Boundary in Snapshot Plugin

**Goal**: Extend the snapshot SWC plugin to detect `'main thread'` module-level directive, generate `mtc-boundary` snapshot type for MTC components, and emit slot markers for BTC children passed to MTC.

**Files**:

- `packages/react/runtime/src/snapshot/dynamicPartType.ts` — add `MtcBoundary = 6`
- `transform/crates/swc_plugin_snapshot/lib.rs` — MTC boundary detection in visitor (~50-100 lines)
- `transform/crates/swc_plugin_snapshot/slot_marker.rs` — may need minor extension for MTC slot wrapping

**Changes**:

1. `dynamicPartType.ts`:

```typescript
export const enum DynamicPartType {
  // ... existing 0-5 ...
  MtcBoundary, // MTC component boundary (6)
}
```

2. In `swc_plugin_snapshot/lib.rs`, when visiting JSX and encountering a component imported from a `'main thread'` module:
   - **Background (JS) side**: Generate `<mtc-boundary>` as snapshot type. Serialize props as dynamic parts. Replace JSX children with slot markers (reuse WrapperMarker from `slot_marker.rs`). Emit `MtcMount`/`MtcUpdate`/`MtcUnmount` ops in the generated updater functions.
   - **Main (LEPUS) side**: Keep the component function body. Emit `registerMTC(hash, component)` call. Wrap component to use `renderMTCSlot()` for slot children.

3. Background snapshot instance generates patches:
   - On mount: `CreateElement('mtc-boundary', id)` + `InsertBefore(parent, id)` + `MtcMount(id, hash, props)`
   - On update: `MtcUpdate(id, newProps)`
   - On unmount: `MtcUnmount(id)` + `RemoveChild(parent, id)`

**Tests**: SWC transform fixture tests

- MTC component with props → verify generated snapshot produces mtc-boundary + MtcMount op
- MTC component with BTC children → verify slot markers generated
- MTC component update → verify MtcUpdate op
- MTC component unmount → verify MtcUnmount op

**Independent value**: Compile output is verifiable via fixture tests before the runtime is wired up. CI can validate the compile contract independently.

**Dependencies**: PR 2 (for `'background'` functions inside MTC components)

---

## PR 5: Webpack Integration

**Goal**: Extend `ReactWebpackPlugin` to detect MTC usage and conditionally inject the MTC runtime chunk, following the existing worklet-runtime pattern.

**Files**:

- `packages/webpack/react-webpack-plugin/src/ReactWebpackPlugin.ts` — add `mtcRuntimePath` option + detection + chunk injection
- `packages/webpack/react-webpack-plugin/test/create-react-config.js` — add `mtcRuntimePath` resolution
- `packages/webpack/react-webpack-plugin/test/cases/mtc-runtime/chunk/` — **NEW** test case
- `packages/webpack/react-webpack-plugin/test/cases/mtc-runtime/not-using/` — **NEW** test case

**Detection mechanism** (same as worklet-runtime):

- The **SWC compile output** (PR 4) emits `registerMTC(hash, component)` calls in Lepus code
- The **webpack plugin** (this PR) string-searches compiled Lepus code for `registerMTC`
- If found, it injects the mtc-runtime IIFE **before** the compiled code
- At runtime: mtc-runtime IIFE runs first → defines `globalThis.registerMTC`. Then compiled code calls it.

**Changes in ReactWebpackPlugin.ts**:

1. Options interface:

```typescript
/** Path to @lynx-js/react/mtc-runtime IIFE bundle. When empty, MTC is disabled. */
mtcRuntimePath?: string;
```

2. In `hooks.beforeEncode.tap`, after worklet-runtime detection (line ~295):

```typescript
if (
  options.mtcRuntimePath
  && lepusCode.root?.source.source().toString()?.includes('registerMTC')
) {
  lepusCode.chunks.push({
    name: 'mtc-runtime',
    source: new RawSource(fs.readFileSync(options.mtcRuntimePath, 'utf8')),
    info: { 'lynx:main-thread': true },
  });
}
```

**Existing patterns to reuse**:

- `ReactWebpackPlugin.ts:273-295` — worklet-runtime detection (exact same pattern)
- `test/cases/worklet-runtime/chunk/rspack.config.js` — test config structure
- `test/create-react-config.js:79-126` — config factory

**Tests**: Rspack integration tests

- `chunk/`: Source with MTC pattern → verify `mtc-runtime` chunk in output with `lynx:main-thread` metadata
- `not-using/`: Source without MTC → verify no `mtc-runtime` chunk

**Dependencies**: PR 3 (mtc-runtime package exists), PR 4 (compile generates detectable marker)

---

## PR 6: E2E Integration Tests

**Goal**: Validate the full MTC pipeline end-to-end: source → compile → build → patch → render.

**Files**:

- `packages/react/runtime/__test__/mtc/` — **NEW** integration test directory
- Additional SWC fixture tests for edge cases
- (Optional) Example app in `packages/react/examples/mtc/`

**Test scenarios**:

1. Basic MTC component renders with props
2. Props update triggers re-render
3. Component unmount triggers cleanup
4. BTC children (slots) render inside MTC component
5. BTC child update does NOT trigger MTC re-render (slots update in-place)
6. Background Action (`'use background'`) from MTC calls background thread via `runOnBackground()`
7. Error in one MTC island doesn't crash others
8. Page destroy cleans up all MTC instances
9. Non-MTC build has zero MTC code in bundle

**Dependencies**: All prior PRs (1-5)

---

## Verification Checklist (per PR)

| PR | How to verify                                                                             |
| -- | ----------------------------------------------------------------------------------------- |
| 1  | `vitest run` in `runtime/` — registry tests pass                                          |
| 2  | `cargo test` in `transform/` — SWC fixture tests pass                                     |
| 3  | `vitest run` in `mtc-runtime/` — unit tests pass; `rslib build` produces dev.js + main.js |
| 4  | `cargo test` in `transform/` — MTC boundary fixture tests pass                            |
| 5  | Rspack integration tests in `react-webpack-plugin/test/` pass                             |
| 6  | Full E2E integration tests pass                                                           |

## Key Principle

Every PR should pass the question: _"What can a developer do with this that they couldn't before?"_

1. **PR 1**: Register custom patch handlers to extend the snapshot system
2. **PR 2**: Write `'use background'` functions that call back to background thread
3. **PR 3**: Render Preact components on the main thread via MTC patch ops
4. **PR 4**: Write `'main thread'` components and have the compiler produce correct output
5. **PR 5**: Build a project with MTC components and have the runtime auto-injected
6. **PR 6**: Confidence that the full pipeline works together
