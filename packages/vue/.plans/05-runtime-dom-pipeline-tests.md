# Plan: Phase 3 — Vue runtime-dom Pipeline Tests

## Context

We have two completed testing layers:

- **Phase 1** ✅ — `packages/vue/testing-library/` (20/20 E2E pipeline tests)
- **Phase 2** ✅ — `packages/vue/vue-upstream-tests/` (322/391 runtime-core tests, 69 skipped)

Phase 2 validates the **renderer contract** (ShadowElement linked-list satisfies Vue's VDOM diff), but does NOT test the **PAPI output layer** — i.e., whether `patchProp → ops → applyOps → PAPI → jsdom` produces correct DOM for styles, classes, attributes, events, etc.

React's `preact-upstream-tests` solves this by running 438 Preact tests through the full BG→MT→PAPI→jsdom pipeline. We need the equivalent for Vue: running Vue's `runtime-dom` upstream tests through our pipeline to validate the DOM patching layer.

### Problem

Vue's `runtime-dom` tests directly call internal functions (`patchProp(el, 'style', ...)` on raw DOM elements), not the `render()` API. We need an adapter that:

1. Intercepts `patchProp` / `document.createElement` calls
2. Routes them through our ops pipeline (BG → MT → PAPI → jsdom)
3. Returns real jsdom elements so test assertions (`el.className`, `el.style.color`) work unchanged

---

## Approach: Sync-Flush Pipeline Bridge

**Package**: `packages/vue/vue-upstream-tests/` (extend with second vitest project)

### Core adapter: `src/lynx-runtime-dom-bridge.ts`

A bridge module that makes Vue runtime-dom test patterns work against our pipeline. Two key mechanisms:

#### Mechanism 1: Element Creation Bridge

```
Test calls: document.createElement('div')
  → Bridge creates ShadowElement('div') on BG thread
  → Pushes OP.CREATE + OP.INSERT (into scratch root)
  → Sync-flushes: applyOps → __CreateElement → jsdom element
  → Returns the jsdom element
  → Stores mapping: jsdomEl → shadowEl.id
```

Implementation:

- Override `document.createElement` in test setup
- Maintain a `WeakMap<Element, number>` (jsdom element → shadow element ID)
- After CREATE + INSERT, look up the element in PAPI's `elements` Map by ID
- Return the jsdom element directly — tests can assert `.className`, `.style`, etc.

#### Mechanism 2: patchProp Bridge

```
Test calls: patchProp(el, 'class', null, 'foo')
  → Bridge looks up shadow element ID from jsdom el
  → Calls our real nodeOps.patchProp(shadowEl, 'class', null, 'foo')
  → Pushes OP.SET_CLASS
  → Sync-flushes: applyOps → __SetClasses → el.className = 'foo'
  → Test asserts: el.className === 'foo' ✓
```

Implementation:

- Export `patchProp(el, key, prev, next)` that:
  1. Looks up shadow element ID from `elToIdMap.get(el)`
  2. Gets the ShadowElement from a `Map<number, ShadowElement>`
  3. Calls our `nodeOps.patchProp(shadowEl, key, prev, next)`
  4. Calls `syncFlush()` — takes ops, applies them synchronously via `applyOps`

#### `syncFlush()` — Bypass callLepusMethod for unit tests

Since these are unit tests (not full component renders), we bypass the scheduler:

```ts
function syncFlush(): void {
  const ops = takeOps();
  if (ops.length === 0) return;
  env.switchToMainThread();
  applyOps(ops); // PAPI → jsdom
  env.switchToBackgroundThread();
}
```

This is simpler than the full `queuePostFlushCb → callLepusMethod` path but tests the same ops → PAPI → jsdom pipeline.

### Files to create/modify

#### `src/lynx-runtime-dom-bridge.ts` (NEW)

Core bridge with:

- `createBridgedElement(tag)` — creates ShadowElement + flushes CREATE → returns jsdom element
- `bridgedPatchProp(el, key, prev, next)` — routes through our nodeOps.patchProp + syncFlush
- `syncFlush()` — takes ops, calls applyOps on MT
- `resetBridge()` — clears all maps, resets ShadowElement.nextId
- Element maps: `jsdomToShadowId: WeakMap<Element, number>`, `idToShadow: Map<number, ShadowElement>`

Key detail: For patchProp, the bridge must handle the key format differences:

- Vue runtime-dom tests use standard DOM event names: `onClick`, `onUpdate:modelValue`
- Our nodeOps.patchProp expects: `bindtap`, `onTap`, `bindEvent:click`
- The bridge will pass keys through as-is to our patchProp (which handles `on[A-Z]` pattern already)

#### `src/runtime-dom-setup.ts` (NEW)

Vitest setup file for runtime-dom tests:

1. Create `LynxTestingEnv` with jsdom
2. Wire MT globals (import `@lynx-js/vue-main-thread`)
3. Wire BG globals (import `@lynx-js/vue-runtime/entry-background`)
4. Override `document.createElement` → `createBridgedElement`
5. Set `globalThis.patchProp` → `bridgedPatchProp`
6. `beforeEach`: resetBridge + clear jsdom body + re-create page root

#### `vitest.config.ts` (MODIFY)

Add second vitest project using workspace projects:

```ts
export default defineConfig({
  // Existing runtime-core project config...
  test: {
    // Use vitest workspace to run both projects
    projects: [
      {/* existing runtime-core config */},
      {
        test: {
          name: 'runtime-dom',
          globals: true,
          include: runtimeDomTests,
          alias: [
            // Alias runtime-dom internal imports → our bridge
            { find: '../patchProp', replacement: bridgePath },
            { find: /^@vue\/runtime-dom$/, replacement: bridgePath },
            // ... other runtime-dom source imports
          ],
          setupFiles: ['./src/runtime-dom-setup.ts'],
        },
      },
    ],
  },
});
```

Alternatively, create a separate `vitest.dom.config.ts` if workspace projects get too complex.

#### `skiplist-dom.json` (NEW)

Separate skiplist for runtime-dom tests.

### Test files to include

From `core/packages/runtime-dom/__tests__/`:

**Tier 1 — Fully adaptable** (~49 tests):

| File                           | Tests | What it validates                                        |
| ------------------------------ | ----- | -------------------------------------------------------- |
| `patchStyle.spec.ts`           | 12    | Style object/string → `__SetInlineStyles` → `el.style.*` |
| `patchEvents.spec.ts`          | 11    | Event binding → `__AddEvent` → listener registration     |
| `directives/vShow.spec.ts`     | 11    | `display: none` toggle → `__SetInlineStyles`             |
| `patchClass.spec.ts`           | 3     | Class string → `__SetClasses` → `el.className`           |
| `directives/vCloak.spec.ts`    | 1     | Attribute removal on mount                               |
| `rendererStaticNode.spec.ts`   | 5     | Static content insertion                                 |
| `helpers/useCssModule.spec.ts` | 5     | CSS module injection (pure JS)                           |

**Tier 2 — Partially adaptable** (~40 tests, needs skiplist):

| File                     | Adaptable/Total | Skip reasons                       |
| ------------------------ | --------------- | ---------------------------------- |
| `patchProps.spec.ts`     | ~20/29          | Skip: innerHTML, SVG, embed tags   |
| `patchAttrs.spec.ts`     | ~5/7            | Skip: xlink, SVG namespace         |
| `directives/vOn.spec.ts` | ~15/20+         | Skip: capture phase, WebComponents |

**Skip entirely** (Lynx-incompatible):

- `createApp.spec.ts` (SVG container)
- `customizedBuiltIn.spec.ts` (Web Components `is`)
- `customElement.spec.ts` (Shadow DOM, 20+ tests)
- `directives/vModel.spec.ts` (form inputs — Lynx has no `<input>`)

### Import rewriting strategy

Vue runtime-dom tests import internal modules via relative paths:

```ts
import { patchProp } from '../src/patchProp';
import { render, h, nextTick } from 'vue';
```

We need vitest plugins to rewrite these:

1. **`rewriteRuntimeDomImportsPlugin`**:
   - `from '../src/patchProp'` → `from './lynx-runtime-dom-bridge'` (our bridge)
   - `from '../src/nodeOps'` → `from './lynx-runtime-dom-bridge'`
   - `from 'vue'` → `from '@vue/runtime-core'` + bridge exports

2. **Directive tests** (vShow, vOn, vCloak) use `render()` from Vue. These need:
   - `from 'vue'` → alias to a module that exports Vue `render` + `h` + `nextTick` wired through our pipeline
   - The existing `testing-library/src/render.ts` already does this — we can reuse its pattern
   - OR: use `__pipelineRender` approach from React's preact-upstream-tests

### patchProp key mapping

Vue runtime-dom tests call `patchProp(el, key, prev, next)` with standard HTML prop names. Our `nodeOps.patchProp` handles these mappings:

| Test key      | Our patchProp behavior            | PAPI call                                    |
| ------------- | --------------------------------- | -------------------------------------------- |
| `'style'`     | → normalizeStyle → `OP.SET_STYLE` | `__SetInlineStyles(el, obj)`                 |
| `'class'`     | → `OP.SET_CLASS`                  | `__SetClasses(el, str)`                      |
| `'id'`        | → `OP.SET_ID`                     | `__SetID(el, str)`                           |
| `'onClick'`   | → parseEventProp → `OP.SET_EVENT` | `__AddEvent(el, 'bindEvent', 'click', sign)` |
| anything else | → `OP.SET_PROP`                   | `__SetAttribute(el, key, value)`             |

**Gap**: Vue runtime-dom's `patchProp` also handles:

- DOM properties (`.value`, `.checked`) via `shouldSetAsProp()` — our pipeline uses `__SetAttribute` for everything
- Boolean attributes (`disabled`, `readonly`) — need `__SetAttribute(el, key, '')` for true, `null` for false
- `innerHTML` / `textContent` — not supported in Lynx

The bridge will need to handle boolean attribute conversion and skip incompatible operations.

### Technical risks

1. **Element identity**: Tests do `const el = document.createElement('div')` then assert on `el`. Our bridge must ensure the returned element IS the real jsdom element (not a proxy). Since PAPI's `__CreateElement` creates jsdom elements directly, we can return those.

2. **Timing**: `syncFlush()` must be truly synchronous. Our `takeOps` + `applyOps` are both sync, and `LynxTestingEnv.switchToMainThread()` is sync, so this works.

3. **Element mounting**: PAPI's `__CreateElement` creates detached elements. Tests may expect elements to not be in the DOM tree. We should create elements without inserting them into the page root, and only insert on explicit tree operations.

4. **Directive tests need full render**: vShow, vOn, vCloak tests use `render(h(...), el)`. These need the full component rendering pipeline, not just the bridge. Solution: provide a `render` function that goes through our testing-library's pipeline.

---

## Implementation Order

1. Create `src/lynx-runtime-dom-bridge.ts` with `createBridgedElement`, `bridgedPatchProp`, `syncFlush`
2. Create `src/runtime-dom-setup.ts` with LynxTestingEnv wiring
3. Add runtime-dom vitest project config (separate file: `vitest.dom.config.ts`)
4. Add `rewriteRuntimeDomImportsPlugin` to handle import rewriting
5. Start with Tier 1 tests (patchStyle, patchEvents, patchClass)
6. Triage failures, build `skiplist-dom.json`
7. Add Tier 2 tests + directive tests
8. Add `test:dom` script to `package.json`

## Verification

```bash
cd packages/vue/vue-upstream-tests
pnpm run vuejs:init        # ensure submodule
pnpm run test              # runtime-core: 322 pass
pnpm run test:dom          # runtime-dom: target 50+ pass
```

## Key reference files

| File                                                                   | Purpose                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/vue/runtime/src/node-ops.ts`                                 | Our patchProp implementation (event parsing, style normalization) |
| `packages/vue/main-thread/src/ops-apply.ts`                            | Ops → PAPI execution                                              |
| `packages/vue/runtime/src/ops.ts`                                      | Op codes, pushOp, takeOps                                         |
| `packages/testing-library/testing-environment/src/lynx/ElementPAPI.ts` | PAPI → jsdom mappings                                             |
| `packages/react/preact-upstream-tests/setup-nocompile.js`              | React's bridge pattern (reference)                                |
| `packages/vue/testing-library/setup.ts`                                | Existing LynxTestingEnv wiring (reuse pattern)                    |
| `packages/vue/vue-upstream-tests/vitest.config.ts`                     | Existing runtime-core config (extend)                             |
