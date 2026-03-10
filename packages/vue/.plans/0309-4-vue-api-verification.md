# Future Work: Vue API Export Verification Plan

**Created**: 2026-03-09
**Context**: `@lynx-js/vue-runtime` re-exports ~80 Vue 3 public APIs. Most are pure JS
(reactivity, scope, utilities) and trivially safe. This plan tracks the APIs that need
targeted verification because they interact with the renderer, the dual-thread model,
or Lynx's native element lifecycle.

---

## 1. Currently @deprecated (definitely broken)

These are exported as stub functions/constants with dev warnings. They require
renderer options that Vue Lynx does not implement.

| API                     | Root Cause                                                                                                               | Would Unblock                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `createStaticVNode`     | Needs `insertStaticContent` renderer option                                                                              | Implement `insertStaticContent` in node-ops (parse HTML string → multiple CREATE ops)       |
| `Static` (VNode symbol) | Same                                                                                                                     | Same                                                                                        |
| `KeepAlive`             | Creates `createElement('div')` storage container → orphan element on MT; `move` semantics untested                       | Implement hidden storage container (skip CREATE op for off-tree containers)                 |
| `onActivated`           | Depends on KeepAlive                                                                                                     | Unblocked by KeepAlive                                                                      |
| `onDeactivated`         | Depends on KeepAlive                                                                                                     | Unblocked by KeepAlive                                                                      |
| `Teleport`              | String targets need `querySelector` renderer option; direct element refs inapplicable (native elements not on BG thread) | Implement `querySelector` via SelectorQuery bridge, or support Lynx-native "portal" pattern |

### How to verify if we wanted to implement them

#### KeepAlive + onActivated/onDeactivated

```
Test plan:
1. Create a component with KeepAlive wrapping two child components (A, B)
2. Toggle between A and B via v-if
3. Assert that toggling back to A preserves its reactive state (counter value)
4. Assert onActivated fires when component becomes active
5. Assert onDeactivated fires when component becomes inactive
6. Assert no orphan elements accumulate on the Main Thread

Key challenge: The storage container createElement('div') pushes a CREATE op
to the MT. Options:
  a) Intercept: detect off-tree containers in node-ops and skip the CREATE op
  b) Accept: let the orphan exist (it's never inserted into the visual tree)
  c) Override: patch KeepAlive to use a BG-only ShadowElement as storage
```

#### Teleport

```
Test plan:
1. Teleport to a direct ShadowElement reference (not string selector)
2. Assert content renders inside the target element
3. Assert reactivity works inside teleported content
4. Assert unmount cleans up teleported content

Key challenge: Lynx has no DOM querySelector. Options:
  a) Implement querySelector via PAPI __QuerySelector bridge
  b) Only support direct element references (document limitation)
  c) Support a Lynx-specific selector syntax (e.g. css-id based)
```

#### Static VNode

```
Test plan:
1. Component with createStaticVNode('<view>...</view>', 1)
2. Assert the static content renders correctly on MT

Key challenge: insertStaticContent must parse an HTML-like string into
CREATE/INSERT ops. Options:
  a) Simple parser for Lynx element syntax
  b) Re-use Vue's compiler output differently (avoid static hoisting)
  c) Mark as permanently unsupported (static VNodes are an optimization,
     not a functional requirement)
```

---

## 2. Needs verification (exported as-is, likely works)

These APIs have no obvious incompatibility but have not been tested in Lynx's
dual-thread pipeline. Each needs at least one targeted test.

### Priority 1 — used by real apps

| API                    | Why it needs verification                                                                                           | Test approach                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `watchSyncEffect`      | Runs synchronously during reactive flush. Need to confirm ops are still batched correctly (not flushed mid-update). | Create watchSyncEffect that modifies an element prop. Assert single ops batch on MT, not two.                                  |
| `getCurrentInstance`   | Returns component internal instance. Should work but is an escape hatch.                                            | Call inside setup(), assert non-null. Call outside setup(), assert null.                                                       |
| `useId`                | Generates sequential IDs per app. Should be pure JS.                                                                | Mount two components using useId(), assert unique IDs returned.                                                                |
| `useModel`             | Runtime companion for defineModel(). Depends on props/emit.                                                         | SFC with defineModel(), parent passes v-model. Assert two-way binding works.                                                   |
| `onErrorCaptured`      | Error boundary hook.                                                                                                | Parent with onErrorCaptured, child throws in setup(). Assert error caught and component still renders.                         |
| `defineAsyncComponent` | Async component loading.                                                                                            | defineAsyncComponent(() => import('./Foo.vue')). Assert renders after resolve. (May need webpack/rspeedy test, not unit test.) |

### Priority 2 — edge cases / dev tools

| API                 | Why it needs verification                                | Test approach                                                                                                                |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `onRenderTracked`   | Dev-only reactivity debug hook.                          | In **DEV** mode, mount component with reactive data. Assert callback fires with correct DebuggerEvent on first render.       |
| `onRenderTriggered` | Dev-only reactivity debug hook.                          | Same setup, mutate reactive data. Assert callback fires on re-render.                                                        |
| `effectScope`       | Manual reactive scope management.                        | Create scope, run effects inside. Stop scope, assert effects cleaned up.                                                     |
| `onScopeDispose`    | Cleanup inside effectScope.                              | Register callback via onScopeDispose, stop scope, assert callback fired.                                                     |
| `onWatcherCleanup`  | Watcher cleanup (Vue 3.5+).                              | Create watch() that registers onWatcherCleanup. Trigger re-evaluation. Assert cleanup fires before next run.                 |
| `Suspense`          | Async component boundaries. Already exported pre-change. | Wrap defineAsyncComponent in Suspense with #fallback slot. Assert fallback shows during loading, then content after resolve. |

### Priority 3 — compiler output (indirectly tested by any SFC)

These are called by Vue's template compiler output. If any SFC renders correctly,
these are implicitly verified.

| API                                          | Notes                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `withMemo`                                   | Used by v-memo directive. Test: component with v-memo, assert re-render skipped when deps unchanged. |
| `setBlockTracking`                           | Used internally by compiler block tree output.                                                       |
| `pushScopeId` / `popScopeId` / `withScopeId` | Scoped CSS (`<style scoped>`). Already works if CSS scoping works.                                   |
| `toHandlerKey` / `toHandlers`                | Event handler normalization.                                                                         |
| `createSlots`                                | Dynamic slot compilation output. Test: component with dynamic slot names.                            |
| `withDefaults`                               | `<script setup>` + defineProps with defaults. Test: any SFC using withDefaults.                      |

---

## 3. Confirmed safe (no verification needed)

Pure JavaScript, zero renderer dependency. Listed for completeness.

**Reactivity**: `customRef`, `triggerRef`, `toValue`, `isRef`, `isReactive`,
`isReadonly`, `isProxy`, `isShallow`, `markRaw`, `shallowReadonly`

**Utilities**: `version`, `camelize`, `capitalize`, `cloneVNode`, `isVNode`,
`hasInjectionContext`, `toHandlerKey`, `toHandlers`

**VNode symbols**: `Text`, `Comment`, `Fragment`

**Already tested via existing test suite**: `computed`, `ref`, `reactive`,
`watch`, `watchEffect`, `onMounted`, `onUnmounted`, `h`, `createVNode`,
`v-if`, `v-for`, `renderList`, etc. (covered by 63 existing tests)

---

## 4. Suggested implementation order

1. **Write Priority 1 tests** (~6 tests) — validates the most commonly used
   APIs in real application code
2. **Write Priority 2 tests** (~6 tests) — covers edge cases
3. **Evaluate KeepAlive feasibility** — prototype option (b) or (c) from above
4. **Evaluate Teleport feasibility** — decide if Lynx needs a native portal pattern
5. **Skip Static VNode** — it's a compiler optimization, not user-facing;
   `createStaticVNode` deprecation has no practical impact
