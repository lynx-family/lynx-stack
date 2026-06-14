# Lynx DOM Shim — Detailed Design (Shim-Only Scope)

> **Scope:** This document specifies the Lynx DOM Shim's API surface, tier model, and per-API semantic contract under the explicit constraint that **no new Engine PAPI primitives are added**. Everything described here must be implementable on top of `@lynx-js/type-element-api@0.0.8` as it ships today. Engine-side improvements (the original Phase 3 of [Phase_2_to_5_Roadmap.md]) are deferred and called out as **Capability Gaps** where they would otherwise apply.
>
> **Companion docs:**
>
> - `PRD.md` — Phase 1 benchmark deliverable (done)
> - `Phase_1_5_PRD.md` — Phase 1.5 (token cost, model breadth, real Lynx mock)
> - `Phase_2_to_5_Roadmap.md` — multi-phase roadmap (includes Engine PAPI Phase 3; THIS doc replaces Phase 4's "Shim implementation" section with a more concrete spec)
> - `REPORT.md` — Phase 1 report; §2 introduced the 5-tier model
>
> **Inspiration:** React Native's [Nodes API](https://reactnative.dev/docs/nodes) — `ReadOnlyNode → ReadOnlyElement → ReactNativeElement` layering. This document keeps that direction but renames `ReactNativeElement` to a more honest split: `SafeWritable / SafeWriteOnly / UnsafeWritable / Unsupported`, naming the messy middle instead of pretending it's one tier.

---

## 1. Design Constraints

### 1.1 Hard constraints (non-negotiable in this scope)

1. **No new Engine PAPI.** Every Shim API must compose from the 80-ish `__XXX` functions in [`element-papi-reference.d.ts.txt`](packages/dom-shim/benchmarks/src/routes/element-papi-reference.d.ts.txt). If a DOM API requires a primitive that does not exist, the Shim either:
   - implements via O(n) workaround (e.g. `previousSibling` via parent-children walk), or
   - implements via a Shim-side write-through cache (e.g. `style.getPropertyValue` after `setProperty`), or
   - degrades to a lower tier (e.g. `getComputedStyle` becomes "inline-style only"), or
   - throws structured `DOMShimUnsupportedError` (L4).
2. **No Lynx engine version targeting.** Works against today's published `@lynx-js/type-element-api@0.0.8`. If a primitive landed in a newer engine, it does not appear here.
3. **JS-only.** No native bridge work, no new Rust, no new C++. The Shim is a TypeScript package consumed by Lynx app code (or by an LLM-generated bundle).
4. **No Phase 3 dependency.** The roadmap's Phase 3 PAPI gaps (`__PrevElement`, `__RemoveAttribute`, `__RemoveClass`, `__RemoveEvent`, `__RemoveInlineStyle`, `__GetInlineStyleByName`, sync `boundingClientRect`) are explicitly **not** required for any tier described here. They become latent capability gaps documented in §6.

### 1.2 Soft constraints (best-effort)

- **Spec faithfulness over Lynx idiom.** Where a DOM API exists in the WHATWG/WebIDL spec, the Shim implements that name, that signature, that return type. Lynx-native concepts (`view`, `text`, raw-text nodes) hide behind the DOM API.
- **Read-after-write must work for the same JS frame.** Even when the underlying PAPI doesn't expose a read-back path, the Shim uses a write-through cache so `el.setProperty('--x', 'v'); el.getPropertyValue('--x') === 'v'`. Cross-call consistency, not engine consistency.
- **Errors carry source position when possible.** Use `Error().stack` parsing or `V8.captureStackTrace` polyfill so the LLM agent loop can locate the violation in its emitted code.

### 1.3 Out of scope for this document

- Phase 3 Engine PAPI gap proposals — covered in `Phase_2_to_5_Roadmap.md` §Phase 3.
- LLM benchmark / corpus / scoring — Phase 1 / 1.5.
- The threading model decision (`OQ-2.1` from the roadmap) — referenced where relevant but not resolved here; this doc assumes **main-thread Shim only** and notes where dual-thread changes the contract.
- Bundle-size budget — `OQ-4.1` from roadmap.

---

## 2. Tier Model

Five tiers, named by their **semantic contract**, not by their API count:

| Tier    | Class name                            | What it guarantees                                                                                                                                          | Failure mode if violated                                                                      |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **L1**  | `ReadOnlyNode`, `ReadOnlyElement`     | All reads return engine's last committed state for the property. Sync. Idempotent.                                                                          | Never violates — this tier has no mutations.                                                  |
| **L2**  | `SafeWritableElement`                 | Mutation is atomic and immediately observable via the corresponding L1 getter on the same JS frame.                                                         | Throws `DOMShimInvariantError` if mutation fails (e.g. removeChild of non-child).             |
| **L3a** | `EventfulElement` (extends L2)        | `addEventListener`/`removeEventListener` honor (type, handler, capture) identity. Multiple handlers per type supported. Bubble phase semantics best-effort. | Capture-phase spec deviation documented per-API.                                              |
| **L3b** | `UnsafeWritableElement` (extends L3a) | `innerHTML`, `outerHTML`, `cssText`, `textContent` setters run. They are NOT round-trip safe. Per-API divergence documented in code-level diagnostics.      | Each call site emits `console.warn` with diagnostic on first divergent execution per element. |
| **L4**  | (unsupported surface)                 | Access throws structured `DOMShimUnsupportedError` at the call site, with a suggested L1-L3 alternative.                                                    | Throw, by design.                                                                             |

**Class hierarchy:**

```
L1ReadOnlyNode
├── L1ReadOnlyText               (raw-text emulation)
└── L1ReadOnlyElement
    └── L2SafeWritableElement
        └── L3aEventfulElement
            └── L3bUnsafeWritableElement
```

**Inheritance rule.** Every method on a higher-numbered tier is also accessible at lower-numbered tiers via `instanceof` — `el instanceof L1ReadOnlyElement` is true even when `el` is constructed as `L3b`. This matches DOM where `Element` is a true base class.

**Tier selection at construction.**

- `document.createElement(tag)` returns L3b by default (the most-capable tier).
- A package export `import { ReadOnly, SafeWrite } from '@lynx-js/dom-shim/tiers'` lets a caller request narrower views: `const safe = SafeWrite(el)` returns the same backing `papi: ElementRef` but typed as L2. Calls to L3 methods on the narrowed type are compile-time errors.
- This lets app authors AND LLM prompts pin a "max tier" for a given subtree, e.g. "render this list at L2 only" rejects code that tries `innerHTML`.

**Why "tier selection" at all.** The whole pitch of the Shim is that LLM-emitted code is unpredictable in which DOM corner it pokes. By making the tier a typed concept, an LLM system prompt can say "you may only use ReadOnly + SafeWrite" and TypeScript enforces it at code-review time without the agent ever having to know about Lynx PAPI. This is the only way the "LLM-friendly" claim from the original Lark RFC actually pays off.

---

## 3. PAPI Surface Inventory

Bucketed against what the Shim consumes:

### 3.1 What Engine PAPI gives us (used by Shim)

```
Tree create:    __CreatePage, __CreateComponent, __CreateView, __CreateScrollView,
                __CreateText, __CreateRawText, __CreateImage, __CreateWrapperElement,
                __CreateElement (generic tag)
Tree mutate:    __AppendElement, __RemoveElement, __InsertElementBefore,
                __SwapElement, __ReplaceElement, __ReplaceElements
Tree traverse: __GetParent, __GetChildren, __FirstElement, __LastElement,
                __NextElement, __GetElementByUniqueID, __GetTag,
                __GetElementUniqueID, __ElementIsEqual, __GetPageElement
Attribute:      __SetAttribute, __GetAttributeByName, __GetAttributeNames, __GetAttributes
Class:          __AddClass, __SetClasses, __GetClasses
Inline style:   __AddInlineStyle (key: number|string),
                __SetInlineStyles (bulk object),
                __GetInlineStyle (node, propertyId: number)   ← number key only
                __GetInlineStyles (node) → serialized string
ID:             __SetID, __GetID
Dataset:        __AddDataset, __SetDataset, __GetDataset, __GetDataByKey
Event:          __AddEvent, __SetEvents, __GetEvent, __GetEvents
Selectors:      __QuerySelector, __QuerySelectorAll
Lifecycle:      __FlushElementTree, __AsyncResolveElement, __AsyncResolveSubtree
Clone:          __CloneElement
Geometry:       __InvokeUIMethod (async callback-based)
Animation:      __ElementAnimate
```

### 3.2 What Engine PAPI does NOT give us (Shim works around)

| Missing primitive                   | DOM API it would have served                                           | Shim workaround                                                                                                                                                                           | Cost                                                          |
| ----------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `__PrevElement`                     | `previousSibling`, `previousElementSibling`                            | Walk `__GetChildren(parent)` to find self index, return `children[i-1]`                                                                                                                   | **O(n)** per access                                           |
| `__RemoveAttribute`                 | `removeAttribute()`                                                    | `__SetAttribute(name, undefined)` + write-through cache                                                                                                                                   | Cache + engine state may keep undefined slot                  |
| `__RemoveClass`                     | `classList.remove()`, `classList.toggle(off)`                          | Read `__GetClasses`, filter, `__SetClasses(filtered.join(' '))`                                                                                                                           | **O(n)** + read-modify-write race                             |
| `__GetInlineStyleByName(string)`    | `style.getPropertyValue('color')`                                      | Write-through cache: every `setProperty` records to a local Map; `getPropertyValue` reads from Map                                                                                        | Cache must be authoritative; external modifications invisible |
| `__RemoveInlineStyle(name)`         | `style.removeProperty('color')`, `style.color = ''`                    | `__AddInlineStyle(name, undefined)` + cache deletion                                                                                                                                      | Engine may persist null slot                                  |
| `__RemoveEvent(node, type, name)`   | `removeEventListener`                                                  | Shim trampoline (see §5.3); never actually un-registers from PAPI; multiplexes in JS                                                                                                      | One PAPI event slot per (node, type), Shim demuxes            |
| Sync `getBoundingClientRect`        | `getBoundingClientRect()`                                              | `__InvokeUIMethod(el, 'boundingClientRect', {}, cb)` is async → spec API is sync. Choose: (a) throw L4, (b) return cached, (c) return zero-rect on first call & cache async-fetched value | Pick (c) as default with `console.warn` first call            |
| `getComputedStyle` (any)            | `getComputedStyle(el).getPropertyValue('color')`                       | No PAPI for resolved style. Shim returns inline-style write-through cache only; non-inline properties throw L4                                                                            | Throws L4 on most CSS properties                              |
| `__GetParent` returns falsy at root | `parentNode === null` distinguishing detached vs root                  | Shim tracks "is page element" via `__GetPageElement` equality                                                                                                                             | Sync, cheap                                                   |
| No text-Node primitive              | `Text` node, `node.firstChild instanceof Text`, `node.nodeValue = 'x'` | Wrap `__CreateRawText` results in `L1ReadOnlyText`, expose `nodeType === 3`, `nodeValue`. Text nodes have no children in DOM; Lynx raw-text is similar                                    | Bookkeeping at construction                                   |

**Note on `__AddInlineStyle(key: number | string, value: unknown)`.** The signature accepts string OR number key for **writes**, but the read-back `__GetInlineStyle` requires a number `propertyId`. This is the most important hidden assumption: it means the Shim cannot read back its own writes through engine alone. The Shim **must** maintain a JS-side write-through cache for inline style. This is not a performance optimization, it's correctness.

---

## 4. Tier 1 — ReadOnly

### 4.1 Surface

```ts
// L1ReadOnlyNode
class L1ReadOnlyNode {
  // Identity
  readonly nodeType: number; // 1=ELEMENT, 3=TEXT
  readonly nodeName: string; // tagName for elements, "#text" for text
  readonly nodeValue: string | null; // text content (text nodes only)

  // Tree (returns L1 views even on L3 elements — see §2 tier selection)
  readonly parentNode: L1ReadOnlyElement | null;
  readonly parentElement: L1ReadOnlyElement | null;
  readonly firstChild: L1ReadOnlyNode | null;
  readonly lastChild: L1ReadOnlyNode | null;
  readonly nextSibling: L1ReadOnlyNode | null;
  readonly previousSibling: L1ReadOnlyNode | null; // O(n)
  readonly childNodes: NodeList; // snapshot
  hasChildNodes(): boolean;

  // Connection
  readonly isConnected: boolean;
  getRootNode(): L1ReadOnlyNode;

  // Comparison
  contains(other: L1ReadOnlyNode | null): boolean;
  compareDocumentPosition(other: L1ReadOnlyNode): number;
  isEqualNode(other: L1ReadOnlyNode | null): boolean;
  isSameNode(other: L1ReadOnlyNode | null): boolean;

  readonly textContent: string; // L1 getter (setter is L3)
}

class L1ReadOnlyElement extends L1ReadOnlyNode {
  readonly id: string;
  readonly tagName: string; // upper-case HTML tag (mapped from Lynx tag)
  readonly localName: string; // lower-case
  readonly className: string; // space-joined
  readonly classList: ReadOnlyDOMTokenList; // .contains, .item, .length, [Symbol.iterator]

  readonly children: HTMLCollection; // snapshot of element children
  readonly firstElementChild: L1ReadOnlyElement | null;
  readonly lastElementChild: L1ReadOnlyElement | null;
  readonly nextElementSibling: L1ReadOnlyElement | null;
  readonly previousElementSibling: L1ReadOnlyElement | null; // O(n)
  readonly childElementCount: number;

  getAttribute(name: string): string | null;
  getAttributeNames(): string[];
  hasAttribute(name: string): boolean;
  hasAttributes(): boolean;
  readonly attributes: NamedNodeMap; // snapshot, throws on mutation attempts

  readonly dataset: Readonly<Record<string, string>>;

  querySelector(s: string): L1ReadOnlyElement | null;
  querySelectorAll(s: string): NodeListOf<L1ReadOnlyElement>;
  matches(s: string): boolean; // O(n) — see §4.2.4
  closest(s: string): L1ReadOnlyElement | null;

  getBoundingClientRect(): DOMRectReadOnly; // see §4.2.5
}
```

### 4.2 Per-API mapping & invariants

#### 4.2.1 Traversal

| Shim getter       | PAPI call                                                                                                                        | Notes                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `parentNode`      | `__GetParent(papi)`                                                                                                              | Returns `null` if result equals `__GetPageElement()`'s parent (which is itself or undefined).                                          |
| `firstChild`      | `__FirstElement(papi)`                                                                                                           | Returns null if `__GetChildren(papi).length === 0`.                                                                                    |
| `lastChild`       | `__LastElement(papi)`                                                                                                            | Symmetric.                                                                                                                             |
| `nextSibling`     | `__NextElement(papi)`                                                                                                            | Returns null if last child of parent.                                                                                                  |
| `previousSibling` | **O(n) walk**: `const c = __GetChildren(parent); const i = c.findIndex(__ElementIsEqual(_, papi)); return i > 0 ? c[i-1] : null` | Documented O(n).                                                                                                                       |
| `childNodes`      | `__GetChildren(papi)`                                                                                                            | Snapshot — DOM spec says live, but we return frozen array wrapped as `NodeList`. **Divergence:** mutations after access don't reflect. |

#### 4.2.2 Element children vs all children

Lynx's element model has no Text node _child of arbitrary element_ — raw text is a child of a `<text>` element. So `firstElementChild === firstChild` will hold for non-text containers but **may differ inside `<text>`** where the first child is a raw-text node.

Shim Behavior:

- Wrap raw-text refs as `L1ReadOnlyText` (a subclass of `L1ReadOnlyNode` but NOT of `L1ReadOnlyElement`).
- `firstChild` may return a text or an element.
- `firstElementChild` filters to elements only.

#### 4.2.3 Attribute & dataset

`getAttribute(name)` ⇒ `__GetAttributeByName(papi, name)`. **Caveat:** PAPI returns `any`, but spec says string-or-null. The Shim coerces via `String(value)` and returns `null` only when `value === undefined || value === null`. This means `setAttribute('x', false); getAttribute('x') === 'false'` — matching DOM.

`dataset` is a proxy over `__GetDataset(papi)`. Reads at access time; writes (in L2) round-trip through `__AddDataset`. **Caveat:** PAPI dataset values are `unknown`; spec says string. Coerce via `String()`.

#### 4.2.4 Selectors

`querySelector` / `querySelectorAll` map directly to `__QuerySelector` / `__QuerySelectorAll` with `{ onlyCurrentComponent: false }` as the default `SelectorParams`.

`matches(s)` has no direct PAPI primitive. Shim implementation:

```
matches(s): boolean {
  const all = __QuerySelectorAll(__GetParent(this.papi) ?? __GetPageElement(), s, {})
  return all.some(ref => __ElementIsEqual(ref, this.papi))
}
```

**Cost: O(n)** in subtree size. Caveat documented; LLM agent loop should prefer `closest(s) === this` for known-parent cases.

`closest(s)` walks parents calling `matches(s)`. O(depth × subtree).

#### 4.2.5 Geometry

`getBoundingClientRect()` is sync in spec, async in Lynx PAPI (`__InvokeUIMethod` is callback-based). Behavior:

- **First call on a never-measured element:** triggers `__InvokeUIMethod(papi, 'boundingClientRect', {}, cb)`, stores result in a `WeakMap<ElementRef, DOMRectReadOnly>`, and returns a zero rect synchronously. Console-warns once per element.
- **Subsequent calls:** return the cached value. Cache invalidated by any L2/L3 mutation on `this` element or any ancestor.
- **DOM-style observers** (`ResizeObserver`) are L4 throw.

**Divergence labeled:** `shim:L1/geometry-cached-stale`.

### 4.3 Read-after-write contract (L1 only)

L1 has no writes. But `el` may be a downcast view of an L3-tier real element. Then:

- `el.getAttribute('x')` after some other code (L2+ holder) did `setAttribute('x', '1')` is consistent: `'1'`.
- `el.getBoundingClientRect()` after a tree mutation: cache invalidated, return zero rect + re-schedule async measurement.

### 4.4 WPT subset target

Phase 5 of the roadmap covers WPT testing. For L1, the realistic pass-rate ceiling on the WPT subset we'd cherry-pick:

| WPT directory                                | L1 pass-rate ceiling | Why not higher                                                        |
| -------------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `dom/nodes/Node-*.html`                      | ~95%                 | `Node.baseURI` not implementable without `document.location` (L4).    |
| `dom/nodes/Element-tagName.html`             | 100%                 | Direct PAPI.                                                          |
| `dom/nodes/Element-classList.html`           | ~80%                 | Getter-side fine; iterator semantics differ from `DOMTokenList` spec. |
| `dom/nodes/Element-childElementCount-*.html` | 100%                 | Direct.                                                               |
| `dom/lists/DOMTokenList.html`                | ~70%                 | `value`, `toString`, iteration — partial.                             |
| `css/cssom/getBoundingClientRect-*.html`     | ~30%                 | Async-cached value can't match spec sync semantics.                   |

---

## 5. Tier 2 — SafeWritable

### 5.1 Surface delta over L1

```ts
class L2SafeWritableElement extends L1ReadOnlyElement {
  // Identity write
  set id(v: string);
  set className(v: string);
  get classList(): L2DOMTokenList; // .add, .remove, .toggle, .replace (mutators added)

  // Attribute write
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  toggleAttribute(name: string, force?: boolean): boolean;

  // Dataset write
  get dataset(): WritableDataset; // Proxy: assignment → __AddDataset, deletion → __SetDataset(rebuild)

  // Inline style
  get style(): L2CSSStyleDeclaration;
  // .setProperty(name, value), .getPropertyValue(name), .removeProperty(name)
  // direct camelCase props: .color, .backgroundColor (compile-time typed against known props)
  // .cssText is L3b

  // Tree mutation
  appendChild<T extends L1ReadOnlyNode>(child: T): T;
  insertBefore<T extends L1ReadOnlyNode>(
    newNode: T,
    refNode: L1ReadOnlyNode | null,
  ): T;
  removeChild<T extends L1ReadOnlyNode>(child: T): T;
  replaceChild<O extends L1ReadOnlyNode, N extends L1ReadOnlyNode>(
    newChild: N,
    oldChild: O,
  ): O;

  // Element-tree convenience
  append(...nodes: (L1ReadOnlyNode | string)[]): void;
  prepend(...nodes: (L1ReadOnlyNode | string)[]): void;
  before(...nodes: (L1ReadOnlyNode | string)[]): void;
  after(...nodes: (L1ReadOnlyNode | string)[]): void;
  replaceWith(...nodes: (L1ReadOnlyNode | string)[]): void;
  remove(): void;

  // Clone (deep is L2 if all descendants are L2-or-below)
  cloneNode(deep?: boolean): this;
}
```

### 5.2 Per-API mapping

#### 5.2.1 ID & className

```
set id(v)        ⇒ __SetID(papi, v); cache.id = v
set className(v) ⇒ __SetClasses(papi, v); cache.classes = v.split(/\s+/).filter(Boolean)
```

#### 5.2.2 classList

`L2DOMTokenList` is a stateful object wrapping `papi`:

```
add(...names)
  - names.forEach(n => __AddClass(papi, n))
  - cache.classes = mergeUnique(cache.classes, names)

remove(...names)
  - newList = cache.classes.filter(c => !names.includes(c))
  - __SetClasses(papi, newList.join(' '))    ⚠ O(n) read-modify-write
  - cache.classes = newList

toggle(name, force?)
  - has = cache.classes.includes(name)
  - if force === undefined: has ? remove(name) : add(name)
  - else: force ? add(name) : remove(name)
  - return !has (per spec)

replace(oldName, newName)
  - i = cache.classes.indexOf(oldName)
  - if i < 0: return false
  - cache.classes[i] = newName
  - __SetClasses(papi, cache.classes.join(' '))    ⚠ O(n)

contains(name)
  - cache.classes.includes(name)    O(1) after cache warm

[Symbol.iterator] / item(i) / length
  - iterate / index cache.classes
```

**Cache invalidation:** `cache.classes` is the source of truth. It is initialized from `__GetClasses(papi)` lazily on first access. It is **NOT** synced with engine-side changes by any other thread. Documented divergence:

> `shim:L2/classlist-jsside-cache` — `classList` reflects only Shim-mediated changes. If native or another worker thread mutates the class attribute, the next Shim read returns stale data until a manual invalidation (`el.classList.refresh()`, Shim-only API).

#### 5.2.3 setAttribute / removeAttribute

```
setAttribute(name, value)
  - __SetAttribute(papi, name, String(value))
  - cache.attrs.set(name, String(value))

removeAttribute(name)
  - __SetAttribute(papi, name, undefined)  ⚠ engine may persist undefined slot
  - cache.attrs.delete(name)

getAttribute(name) [inherited L1, but cache-aware in L2+ instances]
  - if cache.attrs.has(name): return cache.attrs.get(name)
  - else: return __GetAttributeByName(papi, name) ?? null
```

**Divergence:** `shim:L2/attribute-removal-jsside-only` — `removeAttribute` is observable as "absent" via `getAttribute` returning `null`, BUT the engine-side attribute slot may still exist with `undefined`. Native event handlers that inspect attribute presence see the slot. This is invisible to JS callers. Document.

#### 5.2.4 dataset

```ts
const datasetProxy = new Proxy({}, {
  get: (_, k) =>
    k in cache.dataset
      ? cache.dataset[k]
      : __GetDataByKey(papi, String(k)),
  set: (_, k, v) => {
    __AddDataset(papi, String(k), v);
    cache.dataset[k] = String(v);
    return true;
  },
  deleteProperty: (_, k) => {
    delete cache.dataset[k];
    __SetDataset(papi, cache.dataset); // rebuild
    return true;
  },
});
```

**Note:** `delete el.dataset.x` is the only way to remove a dataset key. `__SetDataset` accepts the full object so we rebuild from cache. **O(n) on delete.**

#### 5.2.5 style (the hardest)

`L2CSSStyleDeclaration` wraps `papi` and a write-through cache `cache.styles: Map<string, string>`.

```
setProperty(name, value, priority?)
  - normalized = camelToKebab(name)
  - __AddInlineStyle(papi, normalized, value)     // uses string key
  - cache.styles.set(normalized, String(value))
  - priority is recorded in a parallel Map; not propagated to PAPI (PAPI has no !important slot)

getPropertyValue(name)
  - return cache.styles.get(camelToKebab(name)) ?? ''
  // Why not read PAPI? __GetInlineStyle requires propertyId (number) and we don't have a string→propertyId mapping accessible to JS.
  // Falling back to __GetInlineStyles (returns serialized "k:v;k:v" string) and re-parsing on every read is O(n) and unreliable; the cache is authoritative.

removeProperty(name)
  - __AddInlineStyle(papi, normalized, undefined)
  - cache.styles.delete(normalized)
  - return prev value

cssText / item / length / [Symbol.iterator]
  - L1: cssText getter ⇒ join cache.styles
  - L2: cssText setter ⇒ L3 (parses)

// Direct property access — generated from a static list of CSS property names
// el.style.color = 'red'  ⇒  setProperty('color', 'red')
// generated via a Proxy or via a code-generated subclass with all known props
```

**Divergence:** `shim:L2/style-jsside-cache-authoritative` — the JS cache is the source of truth for `getPropertyValue`. Engine-side property mutations (animations, theme resolution) are NOT visible through `style.getPropertyValue`. They ARE visible through computed-style if we were to wire that — but we don't, see §6.

#### 5.2.6 Tree mutation

```
appendChild(child)
  - if child.parentNode: child.remove()       // spec: re-parenting is implicit removal
  - __AppendElement(this.papi, child.papi)
  - return child

insertBefore(newNode, refNode)
  - if refNode === null: return this.appendChild(newNode)
  - if newNode.parentNode: newNode.remove()
  - __InsertElementBefore(this.papi, newNode.papi, refNode.papi)
  - return newNode

removeChild(child)
  - if child.parentNode !== this: throw new DOMShimInvariantError('NotFoundError')
  - __RemoveElement(this.papi, child.papi)
  - return child

replaceChild(newChild, oldChild)
  - __ReplaceElement(newChild.papi, oldChild.papi)
  - return oldChild

remove()
  - parent = __GetParent(this.papi)
  - if parent: __RemoveElement(parent, this.papi)
```

**Caveats:**

- DOM spec requires `appendChild` to dispatch `DOMNodeInserted` / `DOMNodeRemoved` mutation events on the _deprecated_ event API. The Shim does NOT implement these events (they're deprecated in HTML5).
- `MutationObserver` is L4 throw.

#### 5.2.7 cloneNode

`__CloneElement(papi, { deep })` returns a new `ElementRef`. Wrap as new L2 instance. Children's tier follows the source tree.

### 5.3 Read-after-write contract (L2)

For every L2 method `m(args)`, the corresponding L1 getter on the same JS frame returns the just-written value. Implementation: cache populated synchronously, PAPI call happens before cache update or in parallel — the cache write is what makes the read consistent.

**No explicit `__FlushElementTree` is invoked from L2 mutations** by default. Flush is one of:

- **Auto-flush at microtask boundary** (Shim's default, queues a `queueMicrotask` after first mutation; OQ-2.1 from roadmap).
- **Caller-driven flush** via `import { flush } from '@lynx-js/dom-shim'`.
- **Implicit on event-loop yield** via setTimeout.

The decision between auto and explicit lands in `Phase_2_to_5_Roadmap.md` OQ-2.1; this doc assumes auto-flush at microtask boundary.

### 5.4 WPT pass-rate target

| WPT directory                             | L2 ceiling | Notes                                                |
| ----------------------------------------- | ---------- | ---------------------------------------------------- |
| `dom/nodes/Element-classList.html` (full) | ~75%       | `value=` setter atomicity edges.                     |
| `dom/nodes/ChildNode-remove.html`         | ~95%       | Direct PAPI.                                         |
| `dom/nodes/ParentNode-prepend.html`       | ~90%       | Spec edge for string args.                           |
| `css/cssom/setProperty-*.html`            | ~70%       | `priority` not propagated.                           |
| `dom/nodes/Document-createElement.html`   | ~85%       | Tag map (§7) covers common HTML; obscure tags throw. |
| Attribute removal tests                   | ~70%       | `removeAttribute` is JS-only as documented.          |

---

## 6. Tier 3a — Events

### 6.1 Surface

```ts
class L3aEventfulElement extends L2SafeWritableElement {
  addEventListener(
    type: string,
    handler: EventListener | EventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;

  removeEventListener(
    type: string,
    handler: EventListener | EventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;

  dispatchEvent(event: Event): boolean; // throws L4
}
```

### 6.2 Multiplex strategy

PAPI's `__AddEvent(node, type, name, func)` is one-slot-per-(type,name). DOM allows multiple listeners on `addEventListener(type)`. Solution:

```
const handlers = new WeakMap<ElementRef, Map<EventType, Set<HandlerRecord>>>()
type HandlerRecord = {
  fn: EventListener
  capture: boolean
  once: boolean
  passive: boolean
  signal: AbortSignal | null
}

addEventListener(type, handler, options) {
  const opts = normalizeOptions(options)
  const set = getOrCreate(this.papi, type)

  // Spec: same (type, fn, capture) tuple is a no-op duplicate
  if (Array.from(set).some(r => r.fn === handler && r.capture === opts.capture)) return

  set.add({ fn: handler, capture: opts.capture, once: opts.once, passive: opts.passive, signal: opts.signal })

  if (opts.signal) opts.signal.addEventListener('abort', () => this.removeEventListener(type, handler, opts))

  // Register trampoline only once per (papi, type)
  if (set.size === 1) {
    __AddEvent(this.papi, type, '__shim_trampoline__' + type, makeTrampoline(this.papi, type))
  }
}

removeEventListener(type, handler, options) {
  const opts = normalizeOptions(options)
  const set = handlers.get(this.papi)?.get(type)
  if (!set) return
  for (const r of set) {
    if (r.fn === handler && r.capture === opts.capture) { set.delete(r); break }
  }
  // We do NOT call any PAPI removal; the trampoline simply stops finding entries.
  // Optimization (optional): if set.size === 0, __AddEvent(papi, type, name, undefined) to clear engine slot.
}

function makeTrampoline(papi, type) {
  return function (nativeEvent) {
    const set = handlers.get(papi)?.get(type)
    if (!set) return

    // Synthesize spec-shaped Event from nativeEvent payload
    const event = new ShimEvent(type, nativeEvent)
    event.target = wrapPapi(nativeEvent.target ?? papi)
    event.currentTarget = wrapPapi(papi)
    event.bubbles = true     // default; rare overrides
    event.cancelable = true

    // Capture phase: walk up to root, collect capture-phase listeners, fire top-down
    // Then target phase: fire target's set
    // Then bubble phase: walk up firing non-capture listeners
    // Stop on event.stopPropagation()
    dispatchSimulatedCapture(event)
    if (!event._propagationStopped) dispatchTarget(event, set)
    if (!event._propagationStopped && event.bubbles) dispatchSimulatedBubble(event)

    // Honor `once`
    for (const r of Array.from(set)) if (r.once) set.delete(r)
  }
}
```

### 6.3 Divergences

| Code                             | Behavior                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shim:L3a/capture-synthetic`     | Capture phase is simulated by walking the Shim tree top-down. Lynx native events that fire only at the target are NOT replayed at capture — but DOM listeners registered at capture will still see them via the walk. **Order matches spec for synthetic dispatch; native-only events do not have capture.** |
| `shim:L3a/passive-unenforced`    | `passive: true` is recorded but Lynx PAPI does not have a notion of preventDefault inhibition at the native side. `preventDefault()` in a passive listener is silently ignored (matches spec behavior); but native code may still treat the event as default-prevented.                                      |
| `shim:L3a/event-payload-mapping` | Lynx event payload fields are mapped to DOM Event fields via a static table. Fields outside the table appear under `event.detail.lynxRaw`.                                                                                                                                                                   |
| `shim:L3a/no-untrusted-dispatch` | `dispatchEvent` throws L4. Synthetic event dispatch through the Shim trampoline (`new ShimEvent(...)` invoked manually) is technically possible but not on the surface in v0.                                                                                                                                |

### 6.4 Dual-thread caveat

If Lynx is configured for dual-thread (background JS + main thread layout), the event handler closure has implicit thread affinity. The Shim's `addEventListener` does NOT mediate this. Document:

> `shim:L3a/dual-thread-affinity` — when running in dual-thread mode, the event handler executes on the thread where it was registered. Crossing threads from the handler requires Lynx-specific `'main thread'` / `'background only'` directives, outside this Shim's scope.

This is OQ-2.1 from the roadmap. The Shim is designed to be compatible with both single and dual-thread, but does not paper over the difference.

---

## 7. Tier 3b — UnsafeWritable (innerHTML, etc.)

### 7.1 Surface

```ts
class L3bUnsafeWritableElement extends L3aEventfulElement {
  get innerHTML(): string;
  set innerHTML(html: string);

  get outerHTML(): string;
  set outerHTML(html: string);

  insertAdjacentHTML(position: InsertPosition, html: string): void;
  insertAdjacentText(position: InsertPosition, text: string): void;

  set textContent(v: string);

  // style.cssText becomes available here:
  // accessed via el.style.cssText
}
```

### 7.2 innerHTML pipeline

```
innerHTML = html:
  1. Parse `html` with bundled htmlparser2 → DOM-ish AST
  2. Walk AST, for each node create via tag map (§7.4):
     - if tag is mapped to a Lynx element: create via __CreateView / __CreateText / __CreateImage / etc.
     - if tag is unmapped: __CreateElement(tag, parentComponentUniId) — engine may reject
     - if tag is <script>: SKIP, log diagnostic
     - if tag is <style>: SKIP, log diagnostic (CSS-in-attribute would require selector engine)
  3. Apply attributes via __SetAttribute (after coercion: boolean→"", null→remove)
  4. Apply event handler attributes (on*): WARN, do not install (security)
  5. Apply inline style: parse declarations, __SetInlineStyles({...})
  6. Apply data-*: __AddDataset
  7. Recurse for children
  8. Clear current children of `this` via __RemoveElement(this, each)
  9. Append parsed roots
  10. Schedule auto-flush

innerHTML getter:
  - Walk via __GetChildren + __GetTag + __GetAttributes + __GetClasses + __GetInlineStyles
  - Serialize canonically: attributes sorted, double-quoted, self-closing where applicable
  - NOT round-trip safe with the original input
```

### 7.3 Documented divergences per API

| API                                            | Divergence code                               | Behavior                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `innerHTML = ...`                              | `shim:L3b/script-skipped`                     | `<script>` elements parsed but not created; no execution. WARN once per call.                                                                                                                                                       |
| `innerHTML = ...`                              | `shim:L3b/inline-event-attrs-ignored`         | `onclick="..."` attributes parsed but never installed as handlers (security). WARN.                                                                                                                                                 |
| `innerHTML = ...`                              | `shim:L3b/img-no-load-event`                  | `<img src=...>` creates an image element with src set; **no load/error event** fires unless caller wires via L3a. Document.                                                                                                         |
| `innerHTML = ...`                              | `shim:L3b/listeners-lost`                     | Existing L3a listeners on subtree being replaced are silently dropped from the JS map (they remain registered at PAPI but reference dead refs).                                                                                     |
| `innerHTML = ...`                              | `shim:L3b/css-style-tag-dropped`              | `<style>` tag content is discarded. Inline `style="..."` attributes are honored.                                                                                                                                                    |
| `innerHTML getter`                             | `shim:L3b/serialization-canonical`            | Output is canonical (sorted attrs, double quotes, self-closing for void elements). Input ≠ output even after round-trip on the same tree.                                                                                           |
| `outerHTML setter`                             | Same as innerHTML; replaces self on parent    | inherits above                                                                                                                                                                                                                      |
| `insertAdjacentHTML('beforebegin'/'afterend')` | requires `__GetParent`, no special divergence | OK                                                                                                                                                                                                                                  |
| `insertAdjacentHTML('afterbegin'/'beforeend')` | wraps innerHTML pipeline                      | inherits                                                                                                                                                                                                                            |
| `textContent = ...`                            | `shim:L3b/text-emulated`                      | Removes all children, creates raw-text child via `__CreateRawText`. Lynx text nodes may not behave identically to DOM Text nodes (parent must be `<text>` for visible rendering — Shim auto-wraps in `<text>` if container is not). |
| `style.cssText = ...`                          | `shim:L3b/cssText-reorder`                    | Parsed via CSS declaration parser, applied as `__SetInlineStyles({...parsed})` — property order is the parser's, not the input's. **Important and IDs differ from input.**                                                          |

### 7.4 Tag map (HTML→Lynx)

Initial canonical table, versioned with the Shim package:

| HTML tag                               | Lynx element        | Notes                                                                            |
| -------------------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `div`                                  | `view`              | block layout via class.                                                          |
| `span`                                 | `text`              | inline text.                                                                     |
| `p`                                    | `view`              | block, default class `shim-p`.                                                   |
| `h1`–`h6`                              | `text`              | with class `shim-h1`..`shim-h6` for size.                                        |
| `a`                                    | `text`              | navigation via Shim helper; `href` becomes a data attr until L3a installs onTap. |
| `button`                               | `view`              | interactive; default L3a tap mapping.                                            |
| `img`                                  | `image`             | `src` direct, no load event.                                                     |
| `input`                                | `input`             | partial — `type=text` only. `type=checkbox` etc throw L4 in v0.                  |
| `textarea`                             | `input`             | multi-line variant via Lynx input attrs.                                         |
| `ul`, `ol`                             | `view`              | default list classes.                                                            |
| `li`                                   | `view`              | default `shim-li` class.                                                         |
| `table`, `tr`, `td`, `th`              | `view`              | CSS grid emulation, partial. **Many WPT table tests fail.**                      |
| `form`                                 | `view`              | no native form submission; Shim emits a Shim-only `submit` event.                |
| `label`                                | `text`              | `for=` attr converted to Shim-side click delegation.                             |
| `script`                               | (skipped)           | —                                                                                |
| `style`                                | (skipped or merged) | —                                                                                |
| `link`                                 | (skipped)           | external CSS not supported.                                                      |
| `iframe`, `frame`, `frameset`          | L4 throw            | —                                                                                |
| `video`, `audio`, `canvas`, `svg`      | L4 throw v0         | engine may have direct support; future tier.                                     |
| `details`, `summary`, `dialog`, `menu` | L4 throw v0         | —                                                                                |

Versioned as `packages/dom-shim/SPEC/TAG_MAP.json`. LLM system prompt embeds a summary. Updates are minor-version bumps.

### 7.5 Read-after-write contract for L3b

- `innerHTML = X; outerHTML` returns the L3b-canonical serialization including this element's tag — **NOT** containing the literal `X`.
- `innerHTML = X; firstElementChild.tagName` is consistent with the parse result.
- `innerHTML = X; querySelector('.foo')` works if `X` declared `class="foo"` on a descendant.
- `style.cssText = 'color:red; background:blue'; style.color === 'red'` works (cache).
- `style.cssText = 'color:red'; style.cssText === 'color: red;'` — output is canonicalized.

---

## 8. Tier 4 — Unsupported

### 8.1 What throws

Each entry is "throws `DOMShimUnsupportedError` at access time with structured detail":

```ts
class DOMShimUnsupportedError extends Error {
  code: string; // e.g. 'L4/shadow-dom'
  tier: 4;
  surface: string; // 'Element.attachShadow', 'document.cookie' etc
  position: { file: string; line: number; column: number } | null;
  message: string;
  suggestion: string; // human-readable alternative
}
```

### 8.2 List

| Surface                                          | Code                           | Suggestion                                                                 |
| ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------- |
| `el.attachShadow()`                              | `L4/shadow-dom`                | Use a Shim-side prefix/scoping convention on class names.                  |
| `customElements.define()`                        | `L4/custom-elements`           | Compose with ordinary L3 classes; use a factory function.                  |
| `document.cookie`                                | `L4/cookies`                   | Use Lynx storage API directly.                                             |
| `localStorage` / `sessionStorage`                | `L4/web-storage`               | Use Lynx storage API.                                                      |
| `location.assign()` / `location.href =`          | `L4/location-navigation`       | Use Lynx navigation API.                                                   |
| `history.pushState`                              | `L4/history`                   | Use Lynx router.                                                           |
| `new MutationObserver()`                         | `L4/mutation-observer`         | Subscribe via Shim's own `onMutation` event (v0: not implemented; throws). |
| `new IntersectionObserver()`                     | `L4/intersection-observer`     | Use Lynx intersection PAPI directly via `__InvokeUIMethod`.                |
| `new ResizeObserver()`                           | `L4/resize-observer`           | Poll via `getBoundingClientRect` or use Lynx layout observer.              |
| `getComputedStyle()` for non-inline              | `L4/computed-style-non-inline` | Use inline style + class as your source of truth.                          |
| `new CSSStyleSheet()`                            | `L4/cssom-construct`           | Inline style only.                                                         |
| `document.styleSheets`                           | `L4/cssom-collection`          | (same)                                                                     |
| `new Range()`, `Selection`, `getSelection()`     | `L4/range-selection`           | Not supported.                                                             |
| `window.open()`, `alert`, `confirm`, `prompt`    | `L4/blocking-ui`               | Use Lynx UI APIs.                                                          |
| `XMLHttpRequest`                                 | `L4/xhr`                       | Use `fetch` (if polyfilled by Lynx) or Lynx network PAPI.                  |
| `el.innerText`                                   | `L4/innerText-layout`          | Use `textContent` (lossy: ignores layout).                                 |
| `dispatchEvent` on synthetic Event               | `L4/synthetic-dispatch`        | Not implementable without engine support.                                  |
| `el.requestFullscreen`                           | `L4/fullscreen`                | —                                                                          |
| `el.requestPointerLock`                          | `L4/pointer-lock`              | —                                                                          |
| Pointer events (`pointerdown`, `pointerup`, ...) | `L4/pointer-events`            | Lynx exposes touch/tap; use those event names.                             |
| Drag events (`dragstart`, ...)                   | `L4/drag-events`               | Lynx has no drag concept; use Lynx gesture system.                         |

### 8.3 Why throw vs silently no-op

LLM agent loop benefits from **structured failure**: a thrown `DOMShimUnsupportedError` can be caught in the harness, fed back to the model with the `suggestion` text, and the next iteration self-repairs. A silent no-op produces _wrong output that looks correct_, which is worse — both for human debugging and for benchmark conformance.

---

## 9. Document & Window

The Shim must ship a `document` global stand-in. Minimum surface:

```ts
const document: ShimDocument = {
  // Tree access
  get documentElement(): L3bElement        // alias of __GetPageElement()
  get body(): L3bElement                    // first child <view> of page (Shim convention)
  get head(): null                          // L4: throw on access

  // Factory
  createElement(tag: string): L3bElement
  createTextNode(text: string): L1ReadOnlyText   // exposed as constructable from L2+ but the node itself is L1
  createDocumentFragment(): ShimDocumentFragment // detached subtree holder, see §9.1
  createComment(): L4 throw

  // Query
  querySelector(s: string): L1ReadOnlyElement | null   // __QuerySelector on page
  querySelectorAll(s: string): NodeListOf<...>
  getElementById(id: string): L1ReadOnlyElement | null  // __QuerySelector('#' + id) shorthand
  getElementsByClassName(c: string): HTMLCollection     // snapshot
  getElementsByTagName(t: string): HTMLCollection       // snapshot

  // Document-level events
  addEventListener / removeEventListener  // on page element

  // L4 throw
  cookie / location / URL / referrer / title / readyState / ...
}
```

`window` is similar; mostly L4 except `requestAnimationFrame` (mapped to Lynx's frame callback) and `setTimeout/setInterval` (provided by Lynx runtime, passed through).

### 9.1 DocumentFragment

DocumentFragment in spec is a detached subtree root used for batch insertion. Lynx PAPI has `__CreateWrapperElement(parentComponentUniId)` which behaves similarly — it's a non-rendering wrapper. Map `DocumentFragment` to `__CreateWrapperElement`. `appendChild` to a wrapper works; the wrapper itself when appended to a real parent flattens its children (per DOM spec for DocumentFragment).

---

## 10. Capability Matrix Summary

| DOM surface                            | L1 ReadOnly       | L2 SafeWrite        | L3a Events              | L3b UnsafeWrite    | L4    |
| -------------------------------------- | ----------------- | ------------------- | ----------------------- | ------------------ | ----- |
| Tree traversal                         | ✅ (prev O(n))    |                     |                         |                    |       |
| Tree mutation                          |                   | ✅                  |                         |                    |       |
| Attributes read                        | ✅                |                     |                         |                    |       |
| Attributes write                       |                   | ✅ (remove JS-only) |                         |                    |       |
| classList read                         | ✅                |                     |                         |                    |       |
| classList add/remove/toggle            |                   | ✅ (O(n) remove)    |                         |                    |       |
| dataset read                           | ✅                |                     |                         |                    |       |
| dataset write                          |                   | ✅                  |                         |                    |       |
| inline style read                      | ✅ (cache)        |                     |                         |                    |       |
| inline style write                     |                   | ✅                  |                         |                    |       |
| inline style cssText                   |                   |                     |                         | ✅ (canonical)     |       |
| computed style                         |                   |                     |                         |                    | ❌    |
| getBoundingClientRect                  | ✅ (async-cached) |                     |                         |                    |       |
| scrollWidth/clientWidth                |                   |                     |                         |                    | ❌ v0 |
| addEventListener / removeEventListener |                   |                     | ✅ (synthetic dispatch) |                    |       |
| dispatchEvent                          |                   |                     |                         |                    | ❌    |
| innerHTML/outerHTML                    |                   |                     |                         | ✅ (lossy)         |       |
| textContent read                       | ✅                |                     |                         |                    |       |
| textContent write                      |                   |                     |                         | ✅ (text emulated) |       |
| Shadow DOM                             |                   |                     |                         |                    | ❌    |
| customElements                         |                   |                     |                         |                    | ❌    |
| MutationObserver                       |                   |                     |                         |                    | ❌    |
| document.cookie etc                    |                   |                     |                         |                    | ❌    |

---

## 11. Conformance Goals (no engine work)

Rough pass-rate ceilings on a chosen WPT subset (the exact subset is Phase 5 work; this estimates the achievable maximum under Shim-only scope):

| Subset                                                          | Pass-rate ceiling                                    |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `dom/nodes/` (read-side)                                        | 90%                                                  |
| `dom/nodes/` (write-side)                                       | 70%                                                  |
| `dom/events/`                                                   | 50% (capture / passive / signal edges)               |
| `dom/lists/DOMTokenList`                                        | 70%                                                  |
| `dom/ranges/`                                                   | 0% (L4)                                              |
| `dom/traversal/` (TreeWalker, NodeIterator)                     | 0% (L4 v0, could add at L3 cost)                     |
| `dom/abort/`                                                    | 80% (AbortSignal is just a JS object)                |
| `html/dom/dynamic-markup-insertion/innerhtml/`                  | 30% (canonicalization + lossy parser)                |
| `html/dom/elements/global-attributes/`                          | 60%                                                  |
| `css/cssom/setProperty`                                         | 70% (priority not propagated)                        |
| `css/cssom/getComputedStyle`                                    | 5% (inline only)                                     |
| `selectors/`                                                    | 40% (depends on PAPI's selector engine; we delegate) |
| `pointerevents/`, `touch-events/`, `uievents/` (drag, keyboard) | 0%–20%                                               |

If these ceilings prove too low for the LLM-output use case, the answer is **adding engine PAPI** — Phase 3 of the roadmap.

---

## 12. Open Decisions (Shim-only scope)

These are spec-level open questions that **must** be answered before implementation work in this scope:

- **OQ-S.1** — Flush strategy: auto-microtask vs explicit `flush()` call. Default in this doc: auto-microtask. Cost analysis required on real Lynx mock before lock-in. [Resolved in Phase 1.5 §US-153 if mock-flush data lands.]
- **OQ-S.2** — Tag-map fallback policy: HTML tag with no Lynx mapping → (a) `view` + `data-shim-tag="X"`, (b) `__CreateElement(X, ...)` and trust engine to reject if invalid, (c) throw L4 immediately. Recommended: (a) for permissive default, (c) for strict. **Configurable per tier**.
- **OQ-S.3** — Whether `style.priority` (the CSS `!important`) is stored in cache only or attempted via dual-write (no PAPI primitive). Recommend cache-only with `shim:L2/no-important-propagation` divergence.
- **OQ-S.4** — `getBoundingClientRect` behavior on never-measured element. Three choices in §4.2.5; default to "zero-rect + async fill + warn".
- **OQ-S.5** — DocumentFragment via `__CreateWrapperElement` semantics. Confirm wrapper flattens on append; if not, Shim needs JS-side flatten.
- **OQ-S.6** — Whether to export L1/L2 narrowing helpers (`SafeWrite(el)`, `ReadOnly(el)`) as a runtime cast, a TypeScript-only cast, or both. Recommend both — runtime cast wraps in a Proxy that throws on too-high-tier method access.
- **OQ-S.7** — `document.body` semantics. Lynx's `__GetPageElement()` returns the root; what is "body"? Convention: first child of page or page itself depending on app. Pin via Shim init option.
- **OQ-S.8** — Tag-map versioning. SemVer of `@lynx-js/dom-shim` should be tied to tag-map version. A breaking tag-map change is a major bump.

---

## 13. Implementation Order (within Shim-only scope)

This subsumes Phase 4 of the roadmap but with engine work removed:

```
M1: L1 ReadOnly + Document(read-only) + tag-map v0          [~1 week]
M2: L2 SafeWrite (attrs, classList, dataset, style)          [~1.5 weeks]
M3: L2 SafeWrite (tree ops, cloneNode, fragments)            [~1 week]
M4: L3a Events (trampoline, multiplexing)                    [~1.5 weeks]
M5: L3b innerHTML (parser, tag map, serializer)              [~2 weeks]
M6: L3b textContent/cssText, error diagnostics, L4 throws    [~1 week]
M7: WPT subset harness + dashboard infra                     [~1 week]
```

Total: **~9 weeks engineering, single engineer.** Compare to roadmap's Phase 4 estimate of "~6-10 weeks" — alignment is close because the engine-work skip is mostly absorbed by the workarounds documented here (cache, O(n) walks).

**Critical-path milestones:**

- **End of M2:** L2 ready, a vanilla JS DOM library that only reads/writes attributes can run.
- **End of M4:** A static TodoMVC-like app should run end-to-end. This is the **first usefulness milestone**.
- **End of M5:** v0/Bolt/Artifacts samples that don't use Shadow DOM / customElements can render. This is the **LLM output usefulness milestone**.
- **End of M7:** Public dashboard, compatibility claim is verifiable.

### Exit gates (per milestone)

| Milestone | Exit                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1        | `@lynx-js/dom-shim` typechecks; L1 ReadOnly tests pass; a hand-written read-only sample using `__GetPageElement` + Shim wrappers runs on real Lynx mock. |
| M2        | `el.setAttribute` + `el.classList.add` + `el.style.color = 'red'` work on real Lynx mock; L1 readback consistent.                                        |
| M3        | `el.appendChild(other)` works; `el.cloneNode(true)` works; DocumentFragment flattens.                                                                    |
| M4        | A button with multiple click handlers fires all in registration order; `once` removes; `signal` aborts.                                                  |
| M5        | `el.innerHTML = '<div class="x">hi</div>'; el.querySelector('.x')` returns the child.                                                                    |
| M6        | `el.attachShadow()` throws `DOMShimUnsupportedError` with `code: 'L4/shadow-dom'`.                                                                       |
| M7        | `pnpm wpt-runner` produces a JSON report; CI publishes baseline.                                                                                         |

---

## 14. Risk register

| Risk                                                                                      | Likelihood | Impact | Mitigation                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Style cache desync with engine** (animations, theme) writing inline styles outside Shim | M          | M      | Document `shim:L2/style-jsside-cache-authoritative`; advise users not to use animations + inline `style.x =` on same property; provide `style.refresh()` Shim-only API. |
| **classList read-modify-write race** with native                                          | L          | H      | Document `shim:L2/classlist-jsside-cache`; recommend pinning class mutation to Shim only.                                                                               |
| **PAPI tree-op edge cases** (replacing root, swapping disconnected)                       | M          | M      | Test against real Lynx mock per US-153 (Phase 1.5); add invariant checks.                                                                                               |
| **innerHTML parser bloat** (htmlparser2 ≈30KB)                                            | M          | M      | OQ-S.2 — make L3b an opt-in subpackage `@lynx-js/dom-shim/unsafe`.                                                                                                      |
| **Event capture-phase divergence** breaking a popular web lib                             | M          | M      | Document; test against react-virtual / focus-trap as exit-gate libraries.                                                                                               |
| **Async `getBoundingClientRect` causes layout-dependent libs to misbehave**               | H          | M      | Document; provide opt-in sync mode that throws instead of returning stale.                                                                                              |
| **Tag-map gap** for niche HTML elements LLMs emit                                         | H          | L      | Permissive fallback (OQ-S.2 (a)); track unmapped tags via diagnostic for tag-map evolution.                                                                             |
| **No `getComputedStyle`** breaks libraries that read computed background                  | H          | M      | L4 throw with helpful suggestion to use inline style.                                                                                                                   |

---

## 15. What this design says NO to

To be explicit (per CLAUDE.md principle "说不清解决什么问题的改动，就不该做"):

- **No engine PAPI changes** — even where they would dramatically improve Shim quality (e.g. `__GetInlineStyleByName` would obsolete the entire style cache).
- **No dual-thread Shim variant** — single-thread until OQ-2.1 is resolved.
- **No CSSOM** beyond per-element inline style.
- **No MutationObserver-via-flush-diff** — too expensive on PAPI tree walks.
- **No Range / Selection / Clipboard / FullScreen / PointerLock / Speech** APIs.
- **No HTML form submission semantics** — `form.submit()` throws L4.
- **No automatic Shim version negotiation** with engine — Shim assumes target engine ≥ the `@lynx-js/type-element-api` version it was published against; if engine is older, run-time errors will surface and that's the engine team's responsibility to upgrade.

---

## Appendix A — Diagnostic format

All `console.warn`s and all `DOMShimError` throws follow this JSON shape (matches the structure proposed in `Phase_2_to_5_Roadmap.md` §US-206):

```json
{
  "code": "shim:L3b/script-skipped",
  "tier": 3,
  "subTier": "b",
  "surface": "Element.innerHTML",
  "message": "<script> elements in innerHTML are skipped (no execution).",
  "suggestion": "If you need to load JS dynamically, use Lynx's module loader or set the script src via a Shim-supported way.",
  "position": { "file": "user-code.ts", "line": 42, "column": 12 },
  "elementUid": 7,
  "elementTag": "view"
}
```

The LLM agent loop consumes this JSON to repair its output between rounds.

---

## Appendix B — Reference: PAPI used vs unused

**Used by Shim (this design):** all `__Create*`, `__AppendElement`, `__RemoveElement`, `__InsertElementBefore`, `__ReplaceElement`, `__GetParent`, `__GetChildren`, `__FirstElement`, `__LastElement`, `__NextElement`, `__GetTag`, `__SetAttribute`, `__GetAttributeByName`, `__GetAttributeNames`, `__GetAttributes`, `__AddClass`, `__SetClasses`, `__GetClasses`, `__SetID`, `__GetID`, `__AddInlineStyle`, `__SetInlineStyles`, `__GetInlineStyles`, `__AddDataset`, `__SetDataset`, `__GetDataset`, `__GetDataByKey`, `__AddEvent`, `__SetEvents`, `__GetEvent`, `__GetEvents`, `__FlushElementTree`, `__GetElementUniqueID`, `__ElementIsEqual`, `__GetElementByUniqueID`, `__GetPageElement`, `__QuerySelector`, `__QuerySelectorAll`, `__InvokeUIMethod`, `__CloneElement`, `__SwapElement`, `__ReplaceElements`, `__CreateWrapperElement`.

**Not used by this design (out of scope but available for future tiers):**

- `__CreateComponent`, `__CreatePage` — Shim consumes existing page; component creation is Lynx-side concern.
- `__CreateList`, `__UpdateListCallbacks` — list-virtualization tier (potential L5 future).
- `__CreateElementTemplate`, `__CreateTypedElementTemplate`, `__SetAttributeOfElementTemplate`, etc. — template path; could be used to optimize innerHTML's parser output as a future optimization.
- `__CreateGestureDetector`, `__SetGestureDetector`, `__RemoveGestureDetector`, `__SetGestureState`, `__ConsumeGesture` — gesture surface; future L3a extension to map DOM Pointer/Drag events when Lynx supports them.
- `__SetStaticStyle`, `__CreateStyleObject`, `__SetStyleObject`, `__UpdateStyleObject` — style-object path; an alternative to inline `style.X =` worth measuring against later.
- `__ElementAnimate` — future Web Animations API tier.
- `__SetCSSId`, pipeline-options functions, `__AddTimingListener` — engine-internal lifecycle.

This "unused" list is **future work surface**, not L4. Each unused PAPI is a candidate for a tier expansion when a concrete DOM use case demands it.
