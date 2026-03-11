# Lynx Element PAPI: Design Findings from Vue Research

**Status**: Future plan — document findings for engine/API improvement
**Date**: 2025-03-11
**Context**: During the Vue 3 Lynx implementation, we discovered several
inconsistencies and undocumented constraints in the Lynx Element PAPI
(Platform API). These findings affect all PAPI consumers (React, Vue,
future frameworks) and should be addressed at the engine/API level.

---

## Finding 1: `parentComponentUniqueId` — Silent Semantic Trap

**Severity**: Critical (crashes on Web, silent misbehavior possible on Native)
**Commit**: `2a65fa57` (fix: pass parentComponentUniqueId=1)

### The Problem

All typed element creators (`__CreateView`, `__CreateText`, `__CreateImage`,
`__CreateScrollView`, `__CreateList`) take `parentComponentUniqueId` as their
first (and often only) parameter. This name is misleading — it is NOT the
parent element's ID, but a **component scope ID** used for event routing.

- **Native PAPI**: Silently tolerates incorrect values (e.g. `0`). Elements
  render correctly but component-scoped event dispatch may route to the wrong
  component. No crash, no warning.
- **Web PAPI**: Crashes at event dispatch time. The implementation stores this
  value as a DOM attribute (`l-p-comp-uid`), then on any event uses it to index
  into `lynxUniqueIdToElement[uid]` with non-null assertions:
  ```typescript
  // web-mainthread-apis/ts/createMainThreadGlobalThis.ts:231-232
  const parentComponent = lynxUniqueIdToElement[parentComponentUniqueId]! // undefined when uid=0
    .deref()!; // TypeError: Cannot read properties of undefined
  ```

### Discrepancy Detail

| Behavior                | Native                            | Web                                                                       |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `__CreateView(0)`       | Creates element, works            | Creates element, works                                                    |
| Event on that element   | Dispatches (possibly wrong scope) | **Crashes** — `lynxUniqueIdToElement[0]` is `undefined`                   |
| `__CreatePage` internal | Presumably handles uid internally | Calls `__CreateElement('page', 0)` then **overwrites** attribute to `'1'` |

### Root Cause

The `lynxUniqueIdToElement` array is 1-indexed:

- Index 0: **never populated** (empty slot)
- Index 1: page root (set by `__CreatePage`)
- Index 2+: regular elements

`__CreatePage` knows about this — it passes `0` internally but immediately
overwrites the attribute to `'1'`. But nothing prevents external callers from
passing `0`, and there is no validation.

### Recommendations

1. **Web PAPI should add a guard** instead of non-null assertions:
   ```typescript
   const parentComponent = lynxUniqueIdToElement[parentComponentUniqueId]
     ?.deref();
   if (!parentComponent) {
     console.warn(
       `[PAPI] Invalid parentComponentUniqueId: ${parentComponentUniqueId}`,
     );
     // fall back to page root or skip component-scoped dispatch
   }
   ```

2. **Type declarations should document the constraint**:
   ```typescript
   /**
    * @param parentComponentUniqueId - Component scope ID for event routing.
    *   Must be >= 1. Use 1 for page-root scope. Index 0 is reserved/invalid.
    */
   function __CreateView(parentComponentUniqueId: number): ElementRef;
   ```

3. **Consider a branded type** to prevent accidental misuse:
   ```typescript
   type ComponentUniqueId = number & { __brand: 'ComponentUniqueId' };
   ```

---

## Finding 2: `__SetCSSId` — Array vs Single Element Type Mismatch

**Severity**: Medium (type error, workaround exists)
**File**: `packages/vue/main-thread/src/shims.d.ts` (contains `TODO(huxpro)`)

### The Problem

Three different type declarations for the same function:

| Source                                 | Signature                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `@lynx-js/type-element-api` (upstream) | `__SetCSSId(node: ElementRef, cssId: number)` — **single element**         |
| Web PAPI (`web-mainthread-apis`)       | `__SetCSSId(elements: HTMLElement[], cssId: number)` — **array only**      |
| React runtime (`types.d.ts`)           | `__SetCSSId(e: FiberElement \| FiberElement[], cssId: number)` — **union** |

### Runtime Behavior

Web PAPI implementation unconditionally iterates:

```typescript
// web-mainthread-apis/ts/pureElementPAPIs.ts:269-278
export const __SetCSSId: SetCSSIdPAPI = (elements, cssId, entryName) => {
  for (const element of elements) { // crashes if not iterable
    element.setAttribute(cssIdAttribute, cssId + '');
  }
};
```

Passing a single element (as the upstream type suggests) works on native but
**crashes on web** because a bare `ElementRef` is not iterable.

### Current Workaround

Vue wraps in an array and overrides the type in `shims.d.ts`:

```typescript
__SetCSSId([el], 0); // works on both native and web
```

### Recommendation

Fix `@lynx-js/type-element-api` to match reality:

```typescript
function __SetCSSId(
  node: ElementRef | ElementRef[],
  cssId: number,
  entryName?: string,
): void;
```

Or better — normalize the web PAPI to accept both (handle single element
internally) so downstream consumers don't need to wrap.

---

## Finding 3: `__CreateList` — Undocumented Callback Contract

**Severity**: Medium (no types, no docs, must reverse-engineer from React)

### The Problem

`__CreateList` requires callback functions with very specific signatures that
are not documented in `@lynx-js/type-element-api`:

```typescript
__CreateList(
  parentComponentUniqueId: number,
  componentAtIndex: (list, listID, cellIndex, operationID) => number | undefined,
  enqueueComponent: (...args) => void,
  options: {},
  componentAtIndexes: (list, listID, cellIndexes[], operationIDs[]) => void,
)
```

These callbacks are invoked by the native list when it needs to render cells.
The contract includes:

- Must call `__AppendElement(list, item)` inside the callback
- Must call `__FlushElementTree(item, { triggerLayout, operationID, elementID, listID })`
- Must return `__GetElementUniqueID(item)` from `componentAtIndex`

This was reverse-engineered from React's snapshot compilation output. There
are no type definitions, no documentation, and no error messages if the
contract is violated.

### Recommendation

Add proper TypeScript types and JSDoc to `@lynx-js/type-element-api`.

---

## Finding 4: Platform Info Attributes — Silent Double-Counting

**Severity**: High (causes "duplicated item-key" errors)

### The Problem

List item attributes like `item-key`, `estimated-main-axis-size-px`,
`reuse-identifier`, `full-span`, `sticky-top`, `sticky-bottom`, `recyclable`
have a hidden constraint: they must be set ONLY via `update-list-info`'s
`insertAction`, **never** via direct `__SetAttribute` on the element.

Setting them both ways causes the native list to count items twice, producing
`Error for duplicated list item-key`.

This constraint is not documented anywhere in the PAPI types. It was
discovered by reading React's `snapshot/platformInfo.ts` which maintains a
hardcoded set of these attribute names.

### Recommendation

1. Document which attributes are "platform info only" in PAPI types
2. Consider having `__SetAttribute` warn/no-op for these keys on list children
3. Or provide a dedicated `__SetListItemInfo` API instead of overloading
   `__SetAttribute` with a magic `update-list-info` key

---

## Finding 5: Typed vs Generic Element Creators

**Severity**: Medium (functional degradation without errors)

### The Problem

`__CreateElement("view", uid)` creates a functionally degraded element
compared to `__CreateView(uid)`. Specifically:

- `overflow: hidden` does not clip children on `__CreateElement("view", ...)`
- Native Lynx sets up type-specific internals (hardware-accelerated decoding
  for Image, scroll physics for ScrollView) only via the typed creators

There is no warning or error. The element appears to work but certain CSS
properties or platform optimizations silently fail.

React avoids this entirely because snapshot compilation always generates
typed creator calls. But any dynamic renderer (Vue, or a future framework)
must maintain its own mapping of tag names to typed creators.

### Recommendation

1. `__CreateElement` should internally dispatch to typed creators for known
   types, so callers don't need to maintain the mapping
2. Or at minimum, document which element types REQUIRE typed creators
3. Consider deprecating the tag-based `__CreateElement` for known types

---

## Finding 6: `__FlushElementTree` — Overloaded Semantics

**Severity**: Low (works, but confusing API)

### The Problem

`__FlushElementTree` serves double duty:

- **No args / page arg**: Flush all pending changes to native layer
- **With options `{ triggerLayout, operationID, elementID, listID }`**: Flush
  a specific list item for the native list's `componentAtIndex` callback

These are semantically different operations sharing one function. The options
object format is undocumented.

### Recommendation

Consider splitting into `__FlushElementTree()` and
`__FlushListItem(element, options)` for clarity.

---

## Summary Table

| # | Issue                         | Native         | Web                     | Fix Location                               |
| - | ----------------------------- | -------------- | ----------------------- | ------------------------------------------ |
| 1 | `parentComponentUniqueId=0`   | Silent         | **Crash**               | `web-mainthread-apis` + `type-element-api` |
| 2 | `__SetCSSId` array vs single  | Works (single) | **Crash** (needs array) | `type-element-api` + `web-mainthread-apis` |
| 3 | `__CreateList` callbacks      | Works          | Works                   | `type-element-api` (add types)             |
| 4 | Platform info double-set      | **Error**      | Untested                | `type-element-api` (document)              |
| 5 | `__CreateElement` vs typed    | **Degraded**   | Works                   | Engine (`__CreateElement` dispatch)        |
| 6 | `__FlushElementTree` overload | Works          | Works                   | API design (split functions)               |

---

## Action Items

- [ ] File issue on `@lynx-js/type-element-api` for findings 1, 2, 3
- [ ] File issue on `@lynx-js/web-mainthread-apis` for finding 1 (add guard)
- [ ] File issue on engine for finding 5 (`__CreateElement` typed dispatch)
- [ ] Document platform info attributes (finding 4) in PAPI docs
- [ ] Consider API v2 design addressing findings 3, 5, 6
