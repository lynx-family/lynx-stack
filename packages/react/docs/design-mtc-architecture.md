# MTC (Main Thread Component) — Architecture Redesign

> Design doc for rebuilding MTC from scratch with better engineering.
> Reference: [PR #1530](https://github.com/lynx-family/lynx-stack/pull/1530) (experimental PoC)

## Context

PR #1530 is an experimental proof-of-concept for MTC in ReactLynx. It validates that main-thread components _can_ work, but takes shortcuts that make it unshippable: deep coupling into snapshot core, microtask timing hacks, parallel cross-thread infrastructure, no feature gating, no cleanup. The question is: **how to architect MTC from scratch so it is decoupled, opt-in, and built on existing infrastructure?**

This is a design document, not an implementation plan. It describes the target architecture.

---

## Core Insight: MTC = "Preact Render Island" on the Main Thread

Today, the main thread only executes pre-compiled snapshot templates (opcodes). MTC introduces a second rendering mode: **full Preact rendering on the main thread**, scoped to individual component subtrees. The background thread still owns the overall tree; MTC components are "islands" within it.

---

## Layer 1: Compile (SWC Transforms)

### 1A. Background Action — Reuse the Worklet Plugin

The `'background'` directive is semantically identical to `'main thread'` but in reverse direction. The existing `swc_plugin_worklet` already:

- Detects directives in function bodies
- Extracts closures
- Generates worklet ctx objects (`{ _wkltId, _c, _jsFn, _execId }`)
- Registers worklets via `registerWorklet()`

**Change**: Add `Background` to the `WorkletType` enum in `swc_plugin_worklet/worklet_type.rs` (3 lines). The rest of the plugin logic applies unchanged. On the background thread, the function body is kept; on the main thread, it becomes a `runOnBackground()` handle.

This **eliminates the entire `swc_plugin_ba` (543 lines of Rust)** from the current PR. Background Actions become worklets, reusing all existing infrastructure.

### 1B. MTC Component — Extend the Snapshot Plugin

When the snapshot plugin encounters a module with `'main thread'` directive:

**On the background (JS) thread**:

- The MTC function body is removed (already done by directive DCE)
- JSX calls to the MTC component generate a `<mtc-boundary>` snapshot type
- Props are serialized; JSX children in props are replaced with slot markers (reusing the existing `WrapperMarker` mechanism from `slot_marker.rs`)

**On the main (LEPUS) thread**:

- The MTC function body is kept
- A `registerMTC(hash, component)` call is emitted
- The component is wrapped to use `renderMTCSlot()` for slot children

**Change**: Add MTC boundary detection to `swc_plugin_snapshot/lib.rs` — recognizing components from `'main thread'` modules and emitting the mtc-boundary snapshot type + slot markers.

This **replaces `swc_plugin_mtc` (723 lines of Rust)** with extensions to the existing snapshot plugin, reusing its JSX analysis, dynamic part extraction, and code generation infrastructure.

### 1C. Transform Pipeline

No reordering needed. The existing sequence works:

```
worklet_plugin (extracts 'background' functions)
  → snapshot_plugin (detects MTC boundaries, generates slot markers)
    → directive_dce (removes cross-thread dead code)
      → shake (tree-shakes unused exports)
```

**Files modified**:

- `swc_plugin_worklet/worklet_type.rs` — add `Background` variant (~3 lines)
- `swc_plugin_snapshot/lib.rs` — add MTC boundary detection (~50-100 lines in existing visitor)
- `snapshot/dynamicPartType.ts` — add `MtcBoundary = 6`

**Files NOT created** (vs current PR):

- ~~`swc_plugin_ba/mod.rs`~~ (543 lines eliminated)
- ~~`swc_plugin_mtc/mod.rs`~~ (723 lines eliminated)

---

## Layer 2: Runtime (Main Thread Rendering)

### 2A. Separate Package: `@lynx-js/react/mtc-runtime`

Following the pattern of `@lynx-js/react/worklet-runtime`:

- Self-contained main-thread module
- Loaded on demand (only when MTC components are detected in the bundle)
- Zero cost for non-MTC users

```
packages/react/mtc-runtime/
  src/
    index.ts            // init, cleanup registration
    renderer.ts         // Preact render/unmount for MTC islands
    slot.ts             // BTC child slot adoption
    errorBoundary.ts    // MTC-specific error boundary
```

### 2B. Patch Handler Registry — The One Core Extension Point

Instead of hardcoding MTC logic in `SnapshotInstance.callUpdateIfNotDirectOrDeepEqual()` (current PR), add a **generic extension point** to `snapshotPatchApply.ts`:

```typescript
// snapshotPatch.ts — add new operation codes
export const SnapshotOperation = {
  // ... existing 0-4, 100-102 ...
  MtcMount: 10,
  MtcUpdate: 11,
  MtcUnmount: 12,
} as const;

// snapshotPatchApply.ts — add a registry + default case
const patchHandlerRegistry = new Map<number, (patch: SnapshotPatch, i: number) => number>();

export function registerPatchHandler(
  opCode: number,
  handler: (patch: SnapshotPatch, i: number) => number,
): () => void {
  patchHandlerRegistry.set(opCode, handler);
  return () => patchHandlerRegistry.delete(opCode);
}

// In the switch statement, add:
default: {
  const handler = patchHandlerRegistry.get(snapshotPatch[i] as number);
  if (handler) {
    i = handler(snapshotPatch, i);
  }
  break;
}
```

This is **5 lines added to the core switch** + a 10-line registry. MTC registers its handlers at initialization time. The core snapshot system knows nothing about MTC — it just dispatches to registered handlers.

**Why this is better than the current PR**: The current PR modifies `callUpdateIfNotDirectOrDeepEqual()`, `removeChild()`, `insertBefore()`, `ensureElements()`, and adds `__onDestroy` to `SnapshotInstance`. This redesign touches **zero methods on SnapshotInstance**.

### 2C. MTC Rendering Flow

```
Background thread:                  Main thread:
  Preact renders BTC tree              snapshotPatchApply() loop:
    → encounters MTC boundary            1. CreateElement (mtc-boundary)
    → emits MtcMount op                  2. SetAttributes (slot children IDs)
    → serializes props                   3. MtcMount → handler:
    → renders BTC children                    - lookup component by hash
      normally (they produce                  - Preact render() into container
      snapshot patches as usual)              - adopt slot children elements
                                              - flush element tree

  BTC child updates:                   Normal SetAttribute patches:
    → normal snapshot patches            - update slot children in place
    → + MtcUpdate if MTC props           - MtcUpdate → handler:
      changed                                - Preact render() with new props
                                             - (slot children already updated)

  BTC removes MTC:                     MtcUnmount → handler:
    → MtcUnmount op                      - Preact render(null, container)
    → RemoveChild                        - cleanup
```

### 2D. Slot Mechanism — Deterministic, No Microtask Hack

**Current PR problem**: Uses `Promise.resolve().then()` to wait for slot elements to exist before inserting them.

**Redesign**: The patch list is ordered by the compiler. Within a single patch batch:

1. `CreateElement` + `InsertBefore` operations for BTC slot children come first
2. `MtcMount` comes after, referencing already-created slot element IDs
3. Everything is synchronous within `snapshotPatchApply()`

The MTC mount handler reads slot element IDs from props, looks them up in `snapshotInstanceManager.values`, and adopts them by calling `__AppendElement()`. No timing dependency.

When BTC slot children update, normal `SetAttribute` patches update their elements in place — the MTC component doesn't need to re-render for slot updates.

### 2E. Lifecycle & Cleanup

```typescript
// mtc-runtime/src/index.ts
import { destroyTasks } from '@lynx-js/react/internal';

const mtcInstances = new Map<string, { cleanup: () => void }>();

export function initMtcRuntime(): void {
  // Register patch handlers (returned unregister functions stored for cleanup)
  const unregMount = registerPatchHandler(
    SnapshotOperation.MtcMount,
    handleMount,
  );
  const unregUpdate = registerPatchHandler(
    SnapshotOperation.MtcUpdate,
    handleUpdate,
  );
  const unregUnmount = registerPatchHandler(
    SnapshotOperation.MtcUnmount,
    handleUnmount,
  );

  // Register page-level cleanup
  destroyTasks.push(() => {
    for (const [, inst] of mtcInstances) inst.cleanup();
    mtcInstances.clear();
    unregMount();
    unregUpdate();
    unregUnmount();
  });
}
```

Every MTC instance tracks its cleanup function. Three cleanup triggers:

1. **Normal unmount**: `MtcUnmount` patch op
2. **Page destroy**: via `destroyTasks` (existing hook)
3. **HMR**: re-registration replaces old handlers

### 2F. Error Handling

```typescript
// mtc-runtime/src/errorBoundary.ts
class MTCErrorBoundary extends Component {
  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error(
        `[MTC] Error in ${this.props.componentHash}:`,
        error,
        info.componentStack,
      );
    }
    // Report to Lynx error system
    lynx.reportError?.(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}
```

Every MTC render is wrapped in this boundary. Errors in one MTC island don't crash the entire page.

---

## Layer 3: Bridge (Cross-Thread Communication)

### 3A. Background Actions = `runOnBackground()` (Already Exists)

The existing `runOnBackground()` mechanism:

- Main thread calls `lynx.getJSContext().dispatchEvent()` with `WorkletEvents.runOnBackground`
- Background thread looks up function in `WorkletExecIdMap`, executes, returns result
- Main thread receives result via `WorkletEvents.FunctionCallRet`
- Lifecycle managed by `FinalizationRegistry` (auto-cleanup when unreferenced)

Background Actions use this **as-is**. The `'background'` directive compiles to a worklet ctx, which `runOnBackground()` consumes. No new cross-thread protocol needed.

**Eliminated from current PR**:

- ~~`gBgActions` Map~~ (use existing `WorkletExecIdMap`)
- ~~`registerBgAction()`~~ (use existing `registerWorkletCtx()`)
- ~~`MTCBackgroundFunctionCtx`~~ (use existing `JsFnHandle`)
- ~~Custom dispatch in `runOnBackground.ts`~~ (no modification needed)

### 3B. MTC Events = Worklet Events (Already Exists)

MTC components run on the main thread. Event handlers in MTC are just main-thread functions — they don't need cross-thread dispatch at all. They work like existing worklet event handlers.

**Eliminated from current PR**:

- ~~`mtcEvents` Map~~
- ~~`registerMTCEvent()`~~
- ~~`runMTCEvent` global~~
- ~~Modified `snapshot/event.ts`~~

### 3C. MTC Refs = Worklet Refs (Already Exists)

Refs in MTC components get main-thread `Element` instances directly (same as worklet refs). The existing `addToRefQueue()` / `applyRefQueue()` / `workletUnRef()` pipeline handles this.

**Eliminated from current PR**:

- ~~Modified `snapshot/ref.ts`~~
- ~~Modified `snapshot/workletRef.ts`~~
- ~~`Element` re-export in `mtc/api/element.ts`~~

### 3D. Signals

`@preact/signals` can be used in MTC components because they run full Preact on the main thread. But it should be:

- An **optional peer dependency**, not a hard dependency
- Imported directly by the user (`import { signal } from '@preact/signals'`), not re-exported from `@lynx-js/react/signals`

**Eliminated from current PR**:

- ~~`@preact/signals` as hard dependency~~
- ~~`runtime/signals/` re-export directory~~

---

## Layer 4: Integration (Webpack / Build)

### 4A. Webpack Plugin — Follow worklet-runtime Pattern

The existing `ReactWebpackPlugin` conditionally includes `worklet-runtime` by checking if the compiled output contains `registerWorkletInternal`:

```typescript
// Existing pattern in ReactWebpackPlugin.ts:263-281
if (
  lepusCode.root?.source.source().toString()?.includes(
    'registerWorkletInternal',
  )
) {
  lepusCode.chunks.push({
    name: 'worklet-runtime',
    source: new RawSource(fs.readFileSync(options.workletRuntimePath, 'utf8')),
    info: { ['lynx:main-thread']: true },
  });
}
```

MTC follows the exact same pattern:

```typescript
// New addition (same hook, same pattern):
if (
  lepusCode.root?.source.source().toString()?.includes('__mtc_runtime_init__')
) {
  lepusCode.chunks.push({
    name: 'mtc-runtime',
    source: new RawSource(fs.readFileSync(options.mtcRuntimePath, 'utf8')),
    info: { ['lynx:main-thread']: true },
  });
}
```

### 4B. Configuration

```typescript
interface ReactWebpackPluginOptions {
  // ... existing ...
  /** Path to `@lynx-js/react/mtc-runtime`. When not provided, MTC is disabled. */
  mtcRuntimePath?: string;
}
```

Non-MTC users: don't set `mtcRuntimePath` → no MTC code in bundle, no runtime cost.

---

## Comparison: Current PR vs Redesign

| Aspect                          | Current PR                                                                                                                    | Redesign                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **New SWC plugins**             | 2 new (1266 lines Rust)                                                                                                       | 0 new, extend existing (~100 lines)                                                        |
| **Core files modified**         | ~15 (snapshot.ts, backgroundSnapshot.ts, event.ts, ref.ts, workletRef.ts, opcodes.ts, hydrate.ts, internal.ts, lynx.ts, etc.) | 3 (snapshotPatchApply.ts +15 lines, snapshotPatch.ts +3 lines, dynamicPartType.ts +1 line) |
| **SnapshotInstance changes**    | Modified `callUpdateIfNotDirectOrDeepEqual`, `removeChild`, `insertBefore`, `ensureElements`, added `__onDestroy`             | Zero changes                                                                               |
| **Cross-thread protocol**       | New parallel protocol (gBgActions, mtcEvents, MTCBackgroundFunctionCtx)                                                       | Reuses existing worklet protocol entirely                                                  |
| **Bundle impact for non-users** | Always included (imports `preact` render, `@preact/signals`)                                                                  | Zero (separate chunk, loaded on demand)                                                    |
| **Timing**                      | `Promise.resolve().then()` microtask hack                                                                                     | Synchronous within patch batch                                                             |
| **Memory cleanup**              | 4 global Maps, `gBgActions` never cleaned                                                                                     | All cleanup via existing `destroyTasks` + `FinalizationRegistry`                           |
| **Error handling**              | `!` assertions everywhere                                                                                                     | Error boundary + dev-mode diagnostics                                                      |

---

## File Inventory

### New Files

```
packages/react/mtc-runtime/
  package.json
  src/
    index.ts            // initMtcRuntime(), destroyTasks registration
    renderer.ts         // handleMount/Update/Unmount patch handlers
    slot.ts             // slot adoption (sync element tree insertion)
    errorBoundary.ts    // MTCErrorBoundary component
  __test__/
    renderer.test.ts
    slot.test.ts
```

### Modified Files (Minimal)

| File                                                     | Change                                      | Lines |
| -------------------------------------------------------- | ------------------------------------------- | ----- |
| `runtime/src/lifecycle/patch/snapshotPatchApply.ts`      | Add `patchHandlerRegistry` + `default` case | ~15   |
| `runtime/src/lifecycle/patch/snapshotPatch.ts`           | Add `MtcMount/Update/Unmount` op codes      | ~3    |
| `runtime/src/snapshot/dynamicPartType.ts`                | Add `MtcBoundary = 6`                       | ~1    |
| `transform/crates/swc_plugin_worklet/worklet_type.rs`    | Add `Background` variant                    | ~3    |
| `transform/crates/swc_plugin_snapshot/lib.rs`            | MTC boundary detection in visitor           | ~100  |
| `webpack/react-webpack-plugin/src/ReactWebpackPlugin.ts` | Add MTC chunk inclusion                     | ~15   |
| `webpack/react-webpack-plugin/src/loaders/options.ts`    | Pass `mtcRuntimePath`                       | ~5    |

### Files NOT Modified (vs Current PR)

- `runtime/src/snapshot.ts` (SnapshotInstance untouched)
- `runtime/src/backgroundSnapshot.ts` (untouched)
- `runtime/src/snapshot/event.ts` (untouched)
- `runtime/src/snapshot/ref.ts` (untouched)
- `runtime/src/snapshot/workletRef.ts` (untouched)
- `runtime/src/opcodes.ts` (untouched)
- `runtime/src/hydrate.ts` (untouched)
- `runtime/src/lynx.ts` (untouched)
- `runtime/src/worklet/runOnBackground.ts` (untouched)
- `worklet-runtime/src/*` (entirely untouched)

---

## Verification Plan

1. **Compile layer**: SWC snapshot tests — verify `'main thread'` modules generate mtc-boundary + slot markers
2. **Runtime layer**: Vitest unit tests — mount/update/unmount MTC via patch handlers, verify element tree
3. **Bridge layer**: Integration tests — Background Action calls through `runOnBackground`, events through worklet system
4. **Bundle size**: Verify non-MTC builds have zero MTC code via webpack bundle analysis
5. **E2E**: Example app with MTC component receiving BTC children, Background Actions, refs, signals
