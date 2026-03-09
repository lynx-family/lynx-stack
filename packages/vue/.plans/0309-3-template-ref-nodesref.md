# Vue Template Ref → NodesRef Implementation

## Implementation Result

**Status**: Implemented & verified on LynxExplorer.

### What was done

1. **MT: `vue-ref-{id}` selector attribute** (`ops-apply.ts`)
   - Every non-comment element gets `__SetAttribute(el, 'vue-ref-${id}', 1)` in CREATE and CREATE_TEXT handlers
   - Zero wire overhead — purely MT-side, no extra ops

2. **BG: NodesRef methods on ShadowElement** (`shadow-element.ts`)
   - 8 methods: `invoke`, `setNativeProps`, `fields`, `path`, `animate`, `playAnimation`, `pauseAnimation`, `cancelAnimation`
   - `_selector` getter: `[vue-ref-{id}]` — unique attribute selector per element
   - `_select()`: `lynx.createSelectorQuery().select(this._selector)`
   - Minimal `LynxNodesRef` / `LynxSelectorQuery` interfaces in `shims.d.ts` (structurally compatible with `@lynx-js/types`)

3. **Re-export `useTemplateRef`** from `@vue/runtime-core` via `index.ts`

4. **Gallery e2e migration** — all 4 gallery entries converted from manual `lynx.createSelectorQuery().select('[custom-list-name="..."]')` to `useTemplateRef<ShadowElement>('listRef')` + `listRef.value?.invoke(...)`:
   - `GalleryAutoScroll` — removed `declare const lynx`, removed `custom-list-name` attr
   - `GalleryScrollbar` — same
   - `GalleryScrollbarCompare` — same
   - `GalleryComplete` — same

5. **Tests** — 3 new tests in `ops-coverage.test.ts`:
   - `vue-ref-{id}` attribute set on MT elements
   - `ShadowElement` has all NodesRef methods
   - `_selector` returns correct attribute selector format

### Test results

- testing-library: 31/31 pass (28 existing + 3 new)
- vue-upstream-tests: 778/875 pass, 97 skipped, 0 failures
- LynxExplorer: gallery-autoscroll autoScroll confirmed working via template ref

### Key design decisions

- **Methods on ShadowElement directly** (not a Proxy wrapper like React): Vue's `createRenderer` doesn't expose a `setRef` hook, so ref assignment returns whatever `createElement()` returns. Adding methods to `ShadowElement` is idiomatic — same as `HTMLElement` carrying DOM methods in browser Vue.
- **Attribute on every element** (not just ref'd ones): simpler, no extra BG→MT signaling needed. The `vue-ref-{id}` attribute is tiny and the element already exists. React Lynx sets `react-ref-{id}-{idx}` lazily per-ref, but Vue doesn't have the same snapshot-based ref control.
- **Swiper files unchanged**: they use `useMainThreadRef` for 60fps MT-side manipulation (correct pattern for their use case).

---

## Context

Currently, Vue Lynx's template refs (`ref="x"`) return raw `ShadowElement` objects — lightweight BG-thread tree nodes with no platform API. Users can't call `invoke()`, `setNativeProps()`, etc. on them.

React Lynx solves this with `RefProxy` — a JS Proxy that intercepts method calls and lazily delegates to `lynx.createSelectorQuery().select('[react-ref-{id}-{idx}]')`. This works because React controls ref assignment via its snapshot system.

Vue's `createRenderer` does **not** expose a `setRef` hook — ref assignment happens inside Vue core, directly assigning whatever `createElement()` returns. So we can't intercept it. Instead, we add `NodesRef` methods directly to `ShadowElement`, making it structurally compatible with `@lynx-js/types`'s `NodesRef` interface.

This is idiomatic: in browser Vue, `ref.value` returns `HTMLElement` which carries all DOM methods. `ShadowElement` is Vue Lynx's `HTMLElement`.

## MT/BG Ref Comparison

|            | BG Template Ref (this plan)                              | MT Ref (existing `useMainThreadRef`)                     |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Vue API    | `useTemplateRef<NodesRef>('x')`                          | `useMainThreadRef<T>(init)`                              |
| Bound via  | `ref="x"` (Vue built-in)                                 | `:main-thread-ref="mtRef"`                               |
| Returns    | `ShadowElement` (with NodesRef methods)                  | `MainThreadRef` (worklet ref)                            |
| Thread     | BG → async cross-thread query via SelectorQuery          | MT → sync in-worklet access                              |
| Methods    | `.invoke()`, `.setNativeProps()`, `.fields()`, `.path()` | `.current.setStyleProperty()`, `.current.setAttribute()` |
| Exec model | Deferred — must call `.exec()`                           | Immediate in worklet context                             |
| Use case   | Query element, trigger native methods, animations        | Real-time 60fps UI manipulation                          |

## React Lynx vs Vue Lynx Comparison

|                 | React Lynx                                                                    | Vue Lynx (this plan)                                        |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| User types      | `useRef<NodesRef>(null)`                                                      | `useTemplateRef<NodesRef>('x')` / `ref<NodesRef>()`         |
| Internal impl   | `RefProxy` (JS Proxy class in `lifecycle/ref/delay.ts`)                       | NodesRef methods on `ShadowElement` (direct)                |
| Selector attr   | `react-ref-{snapshotId}-{expIndex}` (set via `__SetAttribute` in `updateRef`) | `vue-ref-{elementId}` (set in MT `applyOps` CREATE handler) |
| When attr set   | When ref is bound to element (lazy, per-ref)                                  | On every element creation (always, on MT side)              |
| Deferred exec   | `RefProxy` delays tasks until after hydration completes                       | Not needed — Vue mounts immediately, elements are ready     |
| NodesRef source | `@lynx-js/types` (`NodesRef` interface)                                       | Same — `ShadowElement` structurally implements `NodesRef`   |

## Implementation

### 1. Set `vue-ref-{id}` attribute on MT element creation

**File**: `packages/vue/main-thread/src/ops-apply.ts`

In the `CREATE` handler, after creating the element, set a unique attribute for selector queries:

```typescript
case OP.CREATE: {
  const id = ops[i++] as number;
  const type = ops[i++] as string;
  let el: LynxElement;
  if (type === '__comment') {
    el = __CreateRawText('');
  } else if (type === 'list') {
    el = createListElement(id);
  } else {
    el = __CreateElement(type, 0);
    __SetCSSId([el], 0);
  }
  elements.set(id, el);
  // Set selector attribute for BG-thread NodesRef queries
  if (type !== '__comment') {
    __SetAttribute(el, `vue-ref-${id}`, 1);
  }
  break;
}
```

Skip comment nodes (`__CreateRawText`) — they can't have attributes and users won't ref them.
Also set on `CREATE_TEXT` elements (rare but possible).

**No extra ops needed** — this is purely MT-side, zero wire overhead.

### 2. Add NodesRef methods to ShadowElement

**File**: `packages/vue/runtime/src/shadow-element.ts`

Add a `declare var lynx` for `createSelectorQuery` access, then add methods:

```typescript
declare var lynx: {
  createSelectorQuery(): SelectorQuery;
} | undefined;

export class ShadowElement {
  // ... existing fields & methods ...

  /** CSS attribute selector that uniquely identifies this element on MT */
  get _selector(): string {
    return `[vue-ref-${this.id}]`;
  }

  private _select(): NodesRef {
    return lynx!.createSelectorQuery().select(this._selector);
  }

  invoke(options: uiMethodOptions): SelectorQuery {
    return this._select().invoke(options);
  }

  setNativeProps(nativeProps: Record<string, unknown>): SelectorQuery {
    return this._select().setNativeProps(nativeProps);
  }

  fields(fields: FieldsParams, callback: FieldsCallback): SelectorQuery {
    return this._select().fields(fields, callback);
  }

  path(callback: PathCallback): SelectorQuery {
    return this._select().path(callback);
  }

  animate(animations: unknown): SelectorQuery {
    return this._select().animate(animations);
  }

  playAnimation(ids: string[] | string): SelectorQuery {
    return this._select().playAnimation(ids);
  }

  pauseAnimation(ids: string[] | string): SelectorQuery {
    return this._select().pauseAnimation(ids);
  }

  cancelAnimation(ids: string[] | string): SelectorQuery {
    return this._select().cancelAnimation(ids);
  }
}
```

Types: Define minimal compatible interfaces in the same file (or a shared types file) to avoid adding `@lynx-js/types` as a hard dependency. The interfaces need only match the method signatures from `@lynx-js/types/types/background-thread/nodes-ref.d.ts`.

### 3. Type exports

**File**: `packages/vue/runtime/src/index.ts`

The `ShadowElement` is already exported. No new exports needed for the implementation itself. Users type their refs with `NodesRef` from `@lynx-js/types` (same as React):

```typescript
import { useTemplateRef } from '@lynx-js/vue-runtime';
import type { NodesRef } from '@lynx-js/types';

const scrollRef = useTemplateRef<NodesRef>('scroll');
```

This works because `ShadowElement` structurally satisfies `NodesRef` (TypeScript structural typing).

### 4. Testing updates

**File**: `packages/vue/testing-library/src/setup.ts` (or new test file)

Add a test verifying that:

- `ref.value` on a mounted element has `invoke`, `setNativeProps`, etc. methods
- The selector attribute `vue-ref-{id}` is set on MT elements
- Calling `invoke()` produces a valid SelectorQuery chain

In the testing environment, `lynx.createSelectorQuery()` may need a stub.

## Files Modified

| File                                         | Change                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `packages/vue/main-thread/src/ops-apply.ts`  | Add `__SetAttribute(el, 'vue-ref-${id}', 1)` in CREATE/CREATE_TEXT |
| `packages/vue/runtime/src/shadow-element.ts` | Add NodesRef methods + minimal type interfaces                     |
| `packages/vue/runtime/src/index.ts`          | No change needed (ShadowElement already exported)                  |

## User-Facing API

```vue
<script setup lang="ts">
import { onMounted, useTemplateRef } from '@lynx-js/vue-runtime';
import { nextTick } from '@lynx-js/vue-runtime';
import type { NodesRef } from '@lynx-js/types';

const scrollRef = useTemplateRef<NodesRef>('scroll');

onMounted(() => {
  nextTick(() => {
    // Element is fully materialized on MT after nextTick
    scrollRef.value?.invoke({
      method: 'autoScroll',
      params: { rate: 60, start: true },
    }).exec();
  });
});
</script>

<template>
  <scroll-view ref="scroll" class="my-list">
    <!-- content -->
  </scroll-view>
</template>
```

## Verification

1. `pnpm build` in `packages/vue/runtime` and `packages/vue/main-thread` — no type errors
2. Existing tests pass: `pnpm test` in `packages/vue/testing-library` and `packages/vue/vue-upstream-tests`
3. E2E: add a gallery entry using `ref` + `invoke()` for autoScroll (replace current `lynx.createSelectorQuery().select(...)` pattern)
4. LynxExplorer: confirm the `invoke({ method: 'autoScroll' })` call works via template ref
