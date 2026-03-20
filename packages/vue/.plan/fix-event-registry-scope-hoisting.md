# Fix: Background Event Registry — rspack Scope Hoisting Singleton Duplication

**Status**: Implemented
**Date**: 2026-03-12
**Branch**: research/vue-lynx

## Problem

Background events (`bindtap`, etc.) are completely broken when using rspack 1.7.8's module concatenation (scope hoisting). The monorepo version at `packages/vue/examples/basic` still works because it uses rspack 1.7.6 which keeps the module as a separate webpack module ID.

### Root Cause

`event-registry.ts` stores event handlers in module-scope variables:

```ts
let signCounter = 0;
const handlers = new Map<string, (data: unknown) => void>();
```

This module is imported by two separate consumers that end up in different concatenation groups:

| Concatenation Group        | Consumer                                                         | Operation                   |
| -------------------------- | ---------------------------------------------------------------- | --------------------------- |
| Group A (entry-background) | `entry-background.ts` → `import { publishEvent }`                | **reads** from handlers Map |
| Group B (Vue runtime)      | `node-ops.ts` → `import { register, unregister, updateHandler }` | **writes** to handlers Map  |

rspack 1.7.8 inlines `event-registry.ts` into BOTH groups, creating two independent `handlers` Maps. `patchProp` → `register()` writes into Map #2, but `publishEvent()` reads from Map #1 (empty) — events silently dropped.

**Why other modules are unaffected**: `ops.ts`, `flush.ts`, `shadow-element.ts` are only imported within Group B. `event-registry.ts` is uniquely cross-group.

**Why it worked before**: rspack 1.7.6 kept `event-registry.ts` as a separate webpack module (ID 805), referenced via `i(805)` — same singleton.

## Solution

Store event state on `globalThis.__vueEventState` instead of module-scope variables. `globalThis` is a single runtime object — all inlined copies within one bundle share it.

```ts
function getState(): VueEventState {
  if (!g['__vueEventState']) {
    g['__vueEventState'] = { signCounter: 0, handlers: new Map() };
  }
  return g['__vueEventState'] as VueEventState;
}
```

Each exported function calls `getState()` on every invocation (no caching) — ensures `resetRegistry()` in tests always works, and the overhead of a single property lookup is negligible at user-interaction rate.

### Why `globalThis` and NOT `lynxCoreInject` (intentional decision)

ReactLynx uses `lynxCoreInject` for similar cross-module shared state. We intentionally chose `globalThis` for Vue Lynx for these reasons:

1. **`lynxCoreInject` adds unnecessary complexity for this use case**: `lynxCoreInject` is an AMD closure parameter injected by `RuntimeWrapperWebpackPlugin`. Accessing it from `event-registry.ts` would require a `typeof lynxCoreInject !== 'undefined'` guard (since the module also runs in test environments without the AMD wrapper), plus a fallback for when it's not available.

2. **Per-invocation isolation is not needed**: The main benefit of `lynxCoreInject` over `globalThis` is per-invocation isolation — each `__init_card_bundle__` call gets its own `lynxCoreInject`. This would matter if we needed the two double-invocations (Lynx calls `__init_card_bundle__` twice) to have separate handler registries. But the double-invocation problem is already solved by the MT-side dedup guard (`elements.has(firstId)` in `applyOps`) — only the first invocation's handlers actually matter.

3. **`globalThis` is simpler and works everywhere**: No guards, no AMD wrapper dependency. Works identically in production bundles, testing-library, and upstream test harness.

4. **Future revisit**: If we ever need per-invocation isolation for event handlers (e.g., multi-card scenarios where each card needs independent event routing), we should revisit and migrate to `lynxCoreInject`. This would require plumbing `lynxCoreInject` as a parameter through the event-registry API, similar to how ReactLynx does it.

## Files Changed

| File                              | Change                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `runtime/src/event-registry.ts`   | Module-scope `signCounter`/`handlers` → `globalThis.__vueEventState` via `getState()` accessor. Removed debug `console.info` logs. |
| `runtime/src/entry-background.ts` | Removed debug `console.info` logs only (no functional change).                                                                     |

## Rejected Alternatives

| Approach                              | Reason                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Pin rspack/rslib versions             | Workaround, not a fix. Breaks on any future version bump.                      |
| Disable module concatenation          | Heavy-handed, loses tree-shaking for entire BG bundle.                         |
| Mark event-registry as side-effectful | Relies on rspack heuristics, not guaranteed across versions.                   |
| Use `lynxCoreInject`                  | See detailed explanation above. Over-engineering for the current problem.      |
| File rspack bug only                  | Correct to do additionally, but we need a fix that doesn't depend on upstream. |

## Verification

- `runtime/` build: clean
- `testing-library/` tests: 31/31 pass (events, reactivity, rendering, styles, v-if/v-for, ops coverage)
- `vue-upstream-tests/`: 778 pass, 97 skipped, 0 failures
- `examples/basic` build: all 5 entries build for both web and lynx targets
