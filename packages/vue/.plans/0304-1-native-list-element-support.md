# Vue Lynx Native `<list>` Element Support

## Scope

Native `<list>` element support in Vue Lynx's Main Thread ops executor (`ops-apply.ts`). Enables waterfall, flow, and single-column list layouts with Lynx's native recycling and lazy-loading infrastructure.

## Context

Lynx's `<list>` is not a regular DOM element — it uses a callback-driven rendering model where the native list engine requests items on demand via `componentAtIndex`. React Lynx creates list elements via `__CreateList()` PAPI (not `__CreateElement('list', 0)`) and informs the native engine about item changes via `__SetAttribute(list, 'update-list-info', ...)`.

Vue Lynx must replicate this pattern on the Main Thread side, since the BG Thread Vue renderer treats `<list>` as a regular element (creates a ShadowElement, inserts children, sets props).

## Problem

Vue's `mountElement` order is: createElement → mountChildren → patchProp → insert. This means:

1. The `<list>` element is created
2. All `<list-item>` children are created and inserted into the list
3. Props like `list-type`, `span-count` are set on the list
4. The list is inserted into its parent

If we use `__CreateElement('list', 0)` and `__AppendElement` directly, items render with wrong dimensions (full width instead of column width) because the native layout engine doesn't know it's a managed list.

## Architecture

```
BG Thread (Vue renderer)                      MT Thread (ops-apply.ts)
┌────────────────────────────┐                ┌─────────────────────────────────┐
│ ShadowElement tree:        │                │ 1. CREATE 'list'                │
│   <list>                   │                │    → __CreateList(0, callbacks) │
│     <list-item key="0"/>   │   ops buffer   │    → track in listElementIds   │
│     <list-item key="1"/>   │ ─────────────► │                                │
│     ...                    │                │ 2. INSERT child into list       │
│   </list>                  │                │    → collect in listItems[]     │
│                            │                │    (do NOT __AppendElement)     │
│ Props: list-type, span-    │                │                                │
│ count, item-key sent as    │                │ 3. SET_PROP 'item-key'          │
│ SET_PROP ops               │                │    → track in itemKeyMap        │
└────────────────────────────┘                │                                │
                                              │ 4. After all ops processed:     │
                                              │    → build insertAction[]       │
                                              │    → __SetAttribute(list,       │
                                              │      'update-list-info', {...}) │
                                              │    → __FlushElementTree()       │
                                              │                                │
                                              │ 5. Native list calls back:      │
                                              │    componentAtIndex(list, ID,   │
                                              │      cellIndex, opID)           │
                                              │    → __AppendElement(list,item) │
                                              │    → __GetElementUniqueID(item) │
                                              │    → __FlushElementTree(item,   │
                                              │        {triggerLayout:true,...}) │
                                              │    → return sign                │
                                              └─────────────────────────────────┘
```

## Implementation Details

### Module-level state (`ops-apply.ts`)

```typescript
/** Per-list: ordered child elements for componentAtIndex */
interface ListItemEntry {
  el: LynxElement;
  bgId: number;
}
const listItems = new Map<number, ListItemEntry[]>();

/** BG element IDs that are <list> elements */
const listElementIds = new Set<number>();

/** item-key values per BG element ID (for list-item children) */
const itemKeyMap = new Map<number, string>();
```

### CREATE op: detect `type === 'list'`

```typescript
case OP.CREATE: {
  if (type === 'list') {
    listElementIds.add(id);
    listItems.set(id, []);
    const cbs = createListCallbacks(id);
    el = __CreateList(0, cbs.componentAtIndex, cbs.enqueueComponent, {}, cbs.componentAtIndexes);
    __SetCSSId([el], 0);
  }
}
```

Key: `__CreateList` takes 3 callbacks (componentAtIndex, enqueueComponent, componentAtIndexes). These are closures that capture the `bgId` to look up items in `listItems`.

### INSERT op: collect instead of append

```typescript
case OP.INSERT: {
  if (listElementIds.has(parentId)) {
    // Collect items — native list will request via componentAtIndex
    const items = listItems.get(parentId);
    if (items) items.push({ el: child, bgId: childId });
  } else {
    // Normal element: append directly
    __AppendElement(parent, child);
  }
}
```

### SET_PROP op: track item-key

```typescript
case OP.SET_PROP: {
  if (el) __SetAttribute(el, key, value);
  if (key === 'item-key') itemKeyMap.set(id, String(value));
}
```

### Post-ops: set `update-list-info`

After the main switch loop, before `__FlushElementTree()`:

```typescript
for (const [bgId, items] of listItems) {
  if (items.length === 0) continue;
  const listEl = elements.get(bgId);
  if (!listEl) continue;
  const insertAction = items.map((entry, j) => ({
    position: j,
    type: 'list-item',
    'item-key': itemKeyMap.get(entry.bgId) ?? String(j),
  }));
  __SetAttribute(listEl, 'update-list-info', {
    insertAction,
    removeAction: [],
    updateAction: [],
  });
}
__FlushElementTree();
```

The `update-list-info` attribute tells the native list engine:

- **insertAction**: items to add, with position + type + item-key
- **removeAction**: indices to remove (empty for initial render)
- **updateAction**: items to update (empty for initial render)

### componentAtIndex callback

Called by the native list when it needs to render item at `cellIndex`:

```typescript
const componentAtIndex = (
  list: LynxElement,
  listID: number,
  cellIndex: number,
  operationID: number,
): number | undefined => {
  const items = listItems.get(bgId);
  if (!items || cellIndex < 0 || cellIndex >= items.length) return undefined;
  const item = items[cellIndex]!.el;
  __AppendElement(list, item);
  const sign = __GetElementUniqueID(item);
  __FlushElementTree(item, {
    triggerLayout: true,
    operationID,
    elementID: sign,
    listID,
  });
  return sign;
};
```

### componentAtIndexes callback (batch)

Called for batch rendering of multiple items at once:

```typescript
const componentAtIndexes = (
  list: LynxElement,
  listID: number,
  cellIndexes: number[],
  operationIDs: number[],
): void => {
  const items = listItems.get(bgId);
  if (!items) return;
  const elementIDs: number[] = [];
  for (let j = 0; j < cellIndexes.length; j++) {
    const item = items[cellIndexes[j]!]!.el;
    __AppendElement(list, item);
    elementIDs.push(__GetElementUniqueID(item));
  }
  __FlushElementTree(list, {
    triggerLayout: true,
    operationIDs,
    elementIDs,
    listID,
  });
};
```

### PAPI declarations added (`shims.d.ts`)

```typescript
function __CreateList(
  parentComponentUniqueId: number,
  componentAtIndex: (...args: any[]) => any,
  enqueueComponent: (...args: any[]) => void,
  info?: object,
  componentAtIndexes?: (...args: any[]) => void,
): LynxElement;

function __GetElementUniqueID(e: LynxElement): number;
function __FlushElementTree(e?: LynxElement, options?: object): void;
```

## Vue Template Requirements

Lynx `<list>` attributes that expect **number types** must use `v-bind` in Vue templates:

```vue
<!-- WRONG: passes string "2" -->
<list span-count="2" list-type="waterfall">

<!-- CORRECT: passes number 2 -->
<list :span-count="2" list-type="waterfall">
```

Affected attributes: `span-count`, `column-count`, `estimated-main-axis-size-px`, `preload-buffer-count`, `scroll-event-throttle`, `lower-threshold-item-count`, `upper-threshold-item-count`.

String-type attributes like `list-type`, `scroll-orientation`, `item-key` are fine without v-bind.

## Differences from React Lynx

| Aspect                  | React Lynx                                                       | Vue Lynx                                                                     |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| List creation           | `__CreateList` in `snapshot/list.ts` during hydration            | `__CreateList` in `ops-apply.ts` during CREATE op                            |
| Item management         | `ListUpdateInfoRecording` tracks inserts/removes/updates         | Simple array collection during INSERT ops                                    |
| Callbacks update        | `__UpdateListCallbacks()` on every flush                         | Callbacks set once at `__CreateList` time (closures over shared `listItems`) |
| Recycling               | Full recycling via `enqueueComponent` + `gSignMap`/`gRecycleMap` | No recycling (enqueueComponent is no-op)                                     |
| Item count notification | `update-list-info` with incremental diffs                        | `update-list-info` with full insert list (initial render only)               |

## Limitations & Future Work

1. **No incremental updates**: Current implementation only handles initial render. Dynamic add/remove of list items (e.g., infinite scroll, filter) would need incremental `update-list-info` with `removeAction`/`updateAction`. The `listItems` array would need to be updated on REMOVE ops for list parents.

2. **No recycling**: `enqueueComponent` is a no-op. For very long lists, this means all items stay in memory. React Lynx recycles off-screen items via `gRecycleMap`.

3. **No `__UpdateListCallbacks`**: React calls `__UpdateListCallbacks` on every data update to refresh the callback closures with new item data. Vue's closures reference the shared `listItems` Map which is mutated in place, so this works for now but may need revisiting for complex update scenarios.

## Files Modified

| File                                              | Changes                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/vue/main-thread/src/ops-apply.ts`       | Added list tracking infrastructure, `createListCallbacks()`, modified CREATE/INSERT/SET_PROP cases, added post-ops `update-list-info` step |
| `packages/vue/main-thread/src/shims.d.ts`         | Added `__CreateList`, `__GetElementUniqueID`, updated `__FlushElementTree` signature                                                       |
| `packages/vue/e2e-lynx/src/gallery/*/Gallery.vue` | Fixed `:span-count="2"` to use v-bind for number type (3 files)                                                                            |

## Verification

All 5 gallery tutorial entries verified on Mac LynxExplorer simulator:

- `gallery-image-card` — single image card renders
- `gallery-like-card` — tap heart → turns red
- `gallery-list` — 2-column waterfall grid, scrollable
- `gallery-scrollbar` — scrollbar tracks scroll position (BG thread)
- `gallery-complete` — MTS scrollbar visible on right edge
