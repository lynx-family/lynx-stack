# Snapshot: Compiler-Hinted Virtual DOM

ReactLynx uses a technique we call **Snapshot** — a **compiler-hinted virtual DOM**, similar in philosophy to [Vue 3's compiler-informed virtual DOM](https://vuejs.org/guide/extras/rendering-mechanism.html#compiler-informed-virtual-dom). The compiler statically analyzes your JSX and generates optimized hints that allow the runtime to skip most of the reconciliation overhead. But crucially, the compiler is **conservative**: it only optimizes what it can statically prove safe, and it **never changes program semantics**.

This guide explains what Snapshot does, why it exists, and how it affects the way you think about ReactLynx.

## The Core Design Principles

Before diving into mechanics, two principles are essential to understanding the Snapshot design:

### 1. The compiler is an optimization, not a rewrite

Snapshot Compilation is conservative. It only transforms **native JSX elements** (like `<view>`, `<text>`) whose structure can be fully analyzed at compile time. It does **not** transform:

- **Custom components** — `<MyButton>` is left as-is for Preact's standard diffing
- **Dynamic element types** — elements whose tag is a variable
- **Spread operators** — fall back to runtime dispatch (the compiler can't know the keys at build time)
- **Conditional subtrees with mixed static/dynamic children** — wrapped in runtime-managed slots

When the compiler can't optimize something, it falls through to the standard Preact code path. The system is designed so that optimized and unoptimized paths coexist in the same render tree.

### 2. The compiler must preserve semantics

The transform is a **pure optimization** — removing it should produce the same observable result. This is a critical correctness invariant:

> You should be able to run the same program with or without the Snapshot transform and get identical output.

This means the runtime must support both paths:

- **With transform**: Preact diffs `{ values: [cls] }` → numeric-indexed patches → compiler-generated `update` functions → Element PAPI
- **Without transform**: Preact diffs `{ className: cls }` → string-keyed patches → runtime dispatch → Element PAPI

Both paths must produce the same Element PAPI calls, and therefore the same rendered UI. This semantic equivalence is what makes the compiler safe — and testable.

## Why Snapshot?

In a standard React (or Preact) renderer, a component like:

```tsx
function Profile({ name, color }) {
  return (
    <view className={color}>
      <text>{name}</text>
    </view>
  );
}
```

produces a virtual DOM tree on every render. The reconciler then diffs every prop on every element: `className` on `<view>`, text content on `<text>`, and so on. This per-prop diffing has real cost — especially on mobile, where ReactLynx runs a [dual-threaded architecture](/react/lifecycle) with the reconciler on a background thread and the actual UI on the main thread.

The Snapshot compiler provides hints that let the runtime skip this per-prop diffing for elements it can statically analyze. It extracts dynamic parts at build time and generates **direct update instructions** for each one. At runtime, the reconciler only needs to compare a single flat `values` array for compiled elements — the rest is handled by compiler-generated code.

## How It Works

### Step 1: Compile — Extract Dynamic Parts

The ReactLynx SWC compiler transforms native JSX elements into **snapshot components**. For example:

```tsx
// What you write
<view className={cls}>
  <text>{name}</text>
</view>;
```

```tsx
// What the compiler produces (simplified)
<__snapshot_a1b2 values={[cls, name]}>
  {children}
</__snapshot_a1b2>;
```

The compiler also generates a **snapshot definition** — a template that tells the runtime how to create and update the native elements:

```js
// Compiler-generated snapshot definition (simplified)
{
  create(ctx) {
    // Called once on the main thread to create native elements
    const view = __CreateView(pageId);
    const text = __CreateText(pageId);
    __AppendElement(view, text);
    return [view, text];
  },

  update: [
    // update[0]: when cls changes
    (ctx) => {
      __SetClasses(ctx.__elements[0], ctx.__values[0]);
    },
    // update[1]: when name changes
    (ctx) => {
      __SetAttribute(ctx.__elements[1], 'text', ctx.__values[1]);
    },
  ],
}
```

Key insight: **individual props like `className` and text content never appear in the runtime diffing path**. They've been compiled into direct Element PAPI calls, indexed by position.

### Step 2: Diff — Compare Only the Values Array

At runtime, Preact's reconciler sees snapshot components as having a single prop: `values`. When your component re-renders:

```
Old: { values: ["red", "Alice"] }
New: { values: ["blue", "Alice"] }
```

Preact only diffs this one prop — a shallow comparison of the `values` array. It doesn't know or care about `className` or text content. It just detects that `values[0]` changed from `"red"` to `"blue"` and calls:

```js
bsi.setAttribute(0, 'blue'); // numeric index, not "className"
```

This is the operation that gets recorded as a **patch** for cross-thread delivery.

### Step 3: Patch — Cross the Thread Boundary

ReactLynx uses a dual-threaded architecture:

- **Background thread**: Runs the Preact reconciler and your component code
- **Main thread**: Owns the actual native UI elements

After the reconciler finishes diffing, all accumulated operations are serialized and sent from the background thread to the main thread:

```
Background Thread                    Main Thread
─────────────────                    ───────────
Preact diff
  └─ bsi.setAttribute(0, "blue")
       └─ push to patch array

commit hook fires
  └─ JSON.stringify(patches)  ──IPC──►  snapshotPatchApply()
                                          └─ si.setAttribute(0, "blue")
                                               └─ update[0](si)
                                                    └─ __SetClasses(el, "blue")
```

On the main thread, `setAttribute(0, "blue")` triggers the compiler-generated `update[0]` function, which calls the Element PAPI method `__SetClasses` directly. There's no prop name lookup, no switch statement — just a direct function call generated at compile time.

### The Full Pipeline

Here's the complete flow, from JSX to pixels:

```
User JSX:  <view className={cls}>hello</view>
                │
                ▼  SWC Compiler (build time)
                │
  <__snapshot_a1b2 values={[cls]}>hello</__snapshot_a1b2>
  + snapshot_def = {
      create(ctx) { ... },
      update: [(ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0])],
    }
                │
                ▼  Preact diff (background thread, runtime)
                │
  Compare { values: ["red"] } vs { values: ["blue"] }
  → bsi.setAttribute(0, "blue")        // numeric index
                │
                ▼  Patch serialization + IPC
                │
  [SetAttribute, id, 0, "blue"]
                │
                ▼  snapshotPatchApply (main thread)
                │
  si.setAttribute(0, "blue")
  → si.__values[0] = "blue"
  → snapshot_def.update[0](si)          // compiler-generated function
  → __SetClasses(el, si.__values[0])    // Element PAPI
```

## What Preact Actually Does

For compiled elements, the Preact reconciler is reduced to three responsibilities:

1. **Tree structure reconciliation** — mounting, unmounting, and reordering components (the same as standard React)
2. **Shuttling the `values` array** — shallow-diffing a single prop and forwarding index-level changes
3. **Triggering the commit hook** — so patches can be flushed across threads

For compiled elements, all prop-level intelligence is handled by the compiler. Preact never calls `setProperty(element, 'className', value)` — that function is completely bypassed.

For uncompiled elements (custom components, spreads, or any case the compiler didn't optimize), Preact follows its standard diffing path with full per-prop comparison. The two modes coexist seamlessly in the same tree.

## What the Compiler Optimizes (and What It Doesn't)

The compiler classifies attributes on native elements into three categories:

| Category | Example                     | Handling                                                                  |
| -------- | --------------------------- | ------------------------------------------------------------------------- |
| Static   | `<view className="header">` | Emitted directly in the `create` function. Zero runtime cost for updates. |
| Dynamic  | `<view className={cls}>`    | Extracted to `values` array. Gets a compiler-generated `update` function. |
| Spread   | `<view {...props}>`         | Falls back to runtime dispatch via `updateSpread()`.                      |

Static attributes are set once during element creation and never touched again. Dynamic attributes are indexed and updated through the compiler-generated `update` functions.

### What is NOT compiled

The compiler is conservative by design. These cases are **not** transformed and follow the standard Preact code path:

- **Custom components**: `<MyButton onClick={fn}>` — Preact diffs all props normally
- **Spread operators**: `<view {...props}>` — the compiler doesn't know which keys will be present, so it emits a runtime `updateSpread()` call that dispatches by string name
- **Dynamic subtrees**: Children that contain conditional logic or custom components are wrapped in runtime-managed "slots" rather than compiled away

This means a typical render tree contains a **mix** of compiled snapshot elements and standard Preact-diffed components:

```
<App>                         ← custom component (standard Preact diff)
  <__snapshot_xyz values={…}> ← compiled native element (values-only diff)
    <MyList>                  ← custom component (standard Preact diff)
      <__snapshot_abc …>      ← compiled native element
```

### The Spread Fallback

When you use JSX spread (`<view {...props} />`), the compiler generates a call to `updateSpread()` — the only runtime function that dispatches from string property names to Element PAPI methods:

```js
// Runtime spread dispatch (simplified)
for (const key in newValue) {
  if (key === 'className')  __SetClasses(el, value);
  else if (key === 'style') __SetInlineStyles(el, value);
  else if (key === 'id')    __SetID(el, value);
  else if (key.startsWith('data-')) /* batch to __SetDataset */
  else if (eventPattern.test(key))  /* route to __AddEvent */
  else __SetAttribute(el, key, value);  // fallback
}
```

This is slower than the compiled path because it involves string comparisons at runtime. For performance-critical components, prefer explicit props over spreads.

## The Two Code Paths

Because the compiler is a pure optimization, the runtime must support two complete code paths that converge to the same result:

### Path A: With Compiler (Production)

```
JSX: <view className={cls}>
       │
       ▼  SWC compiler
<__snapshot values={[cls]}>
       │
       ▼  Preact diffProps
setAttribute("values", [newCls])    ← single prop, array diff
       │
       ▼  BSI
bsi.setAttribute(0, newCls)         ← numeric index
       │
       ▼  Patch IPC
[SetAttribute, id, 0, newCls]
       │
       ▼  SI (main thread)
si.__values[0] = newCls
snapshot_def.update[0](si)          ← compiler-generated function
       │
       ▼  Element PAPI
__SetClasses(el, newCls)
```

### Path B: Without Compiler (Unoptimized)

```
JSX: <view className={cls}>
       │
       ▼  Standard JSX transform (no snapshot compilation)
createElement("view", { className: cls })
       │
       ▼  Preact diffProps
setProperty(bsi, "className", cls)  ← per-prop diffing
       │
       ▼  BSI
bsi.setAttribute("className", cls)  ← string key
       │
       ▼  Patch IPC
[SetAttribute, id, "className", cls]
       │
       ▼  SI (main thread)
runtime dispatch by string key      ← updateSpread-like logic
       │
       ▼  Element PAPI
__SetClasses(el, cls)
```

Both paths end with the same `__SetClasses(el, cls)` call. The rendered output is identical.

### Why This Matters

This semantic equivalence is not just a theoretical property — it's a **testable invariant**. It allows:

1. **Incremental adoption**: The compiler can be enabled per-file or per-component. Uncompiled code works correctly alongside compiled code.
2. **Debugging**: You can disable the transform to isolate whether a bug is in the compiler or the application logic.
3. **Testing without the compiler**: Running Preact's own upstream test suite through the ReactLynx pipeline _without_ the Snapshot transform verifies that the runtime's uncompiled path produces correct results — the same results Preact would produce on the web.
4. **Testing with the compiler**: The [ReactLynx Testing Library](/react/reactlynx-testing-library) runs through the full compiled pipeline, verifying the compiler-generated `update` functions and the `create` functions produce the correct Element PAPI calls.

Together, these two testing approaches form a completeness argument: if Path B (without compiler) matches upstream Preact semantics, and Path A (with compiler) matches Path B's output, then Path A matches upstream Preact semantics.

## How This Affects You

### Performance implications

- **Most updates are O(1) per changed value**: The compiler generates a direct function call for each dynamic part. No searching, no string matching.
- **Unchanged values are skipped**: The runtime checks `isDirectOrDeepEqual(oldValue, newValue)` before calling the update function.
- **Static parts have zero update cost**: They're set once in `create` and never re-evaluated.
- **Spreads are slower**: They require runtime string dispatch. Use explicit props when performance matters.

### What you should (and shouldn't) worry about

**Don't worry about:**

- The number of static props on an element — they're free at update time
- Prop ordering — it doesn't affect performance
- "Too many elements" in a component — only dynamic parts generate update code

**Do consider:**

- Minimizing the number of dynamic values that change frequently
- Preferring explicit props over spreads for hot-path components
- Understanding that `values` array changes are what trigger cross-thread patches

### Interaction with the dual-threaded model

Because patches are serialized via `JSON.stringify` for cross-thread transfer, values must be JSON-serializable. This means:

- `NaN` becomes `null` in transit
- `BigInt` throws during serialization
- Functions are replaced with string identifiers (event handlers are managed separately by the runtime)
- Circular references will cause errors

This is rarely a concern in practice, since element attributes are typically strings, numbers, booleans, or simple objects.

## Comparison with Other Approaches

|                   | Standard React                 | Vue 3 (Compiler-Informed VDOM)          | ReactLynx Snapshot                                                                   |
| ----------------- | ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------ |
| Compiler role     | None (runtime only)            | Hints for static hoisting & patch flags | Full static/dynamic separation + code generation                                     |
| Prop diffing      | Runtime, per-prop              | Runtime, with skip hints                | Compile-time generated, per-index (compiled) or runtime string dispatch (uncompiled) |
| Element creation  | `document.createElement`       | `document.createElement`                | Compiler-generated `create` function with direct PAPI calls                          |
| Attribute updates | `setProperty(el, name, value)` | `patchProp` with patch flags            | `update[i](ctx)` → direct PAPI call                                                  |
| Without compiler  | N/A                            | Render functions (full runtime diff)    | Standard Preact diff → runtime dispatch → same PAPI calls                            |
| Thread model      | Single-threaded                | Single-threaded                         | Dual-threaded (reconciler on background, UI on main)                                 |

Like Vue 3, the Snapshot system is a **compiler-hinted virtual DOM**: it keeps the virtual DOM's programming model and flexibility while using compile-time analysis to skip unnecessary work. Unlike Vue 3's patch flags, ReactLynx generates actual update function bodies that call Element PAPI directly — a deeper level of compilation suited to the dual-threaded architecture where minimizing cross-thread patch size is critical.

## Summary

Snapshot is the compiler-hinted virtual DOM that makes ReactLynx performant on mobile:

1. **Conservative by design** — only optimizes what the compiler can statically prove safe. Custom components, spreads, and dynamic subtrees fall through to standard Preact diffing.
2. **Semantics-preserving** — the transform is a pure optimization. The same program produces the same output with or without the compiler. This makes the system testable and incrementally adoptable.
3. **Reduces reconciler work** — for compiled elements, Preact only diffs a flat `values` array instead of individual props.
4. **Generates direct update paths** — each dynamic part gets a compile-time function that calls the exact Element PAPI method needed, with no runtime string dispatch.
5. **Enables the dual-threaded architecture** — patches are minimal (indexed values, not key-value pairs), making cross-thread serialization fast.

You write standard React JSX. The compiler provides hints. The runtime respects both paths.
