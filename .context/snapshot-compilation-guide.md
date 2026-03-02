# Snapshot: Compiler-Hinted Virtual DOM

ReactLynx uses a technique called **Snapshot** — a **compiler-hinted virtual DOM**. Similar in philosophy to [Vue 3's compiler-informed virtual DOM](https://vuejs.org/guide/extras/rendering-mechanism.html#compiler-informed-virtual-dom), the compiler statically analyzes your JSX and generates optimized code that lets the runtime skip most of the reconciliation work. But unlike a full AOT compilation, the Snapshot compiler is **conservative**: it only optimizes what it can statically prove safe, and the unoptimized path remains fully functional.

This guide explains what Snapshot does, why it exists, and how it shapes the ReactLynx rendering pipeline.

## Design Principles

Two principles are essential to understanding Snapshot:

### The compiler is an optimization, not a replacement

Snapshot only transforms **native JSX elements** (`<view>`, `<text>`, etc.) whose structure can be fully analyzed at compile time. It does **not** transform:

- **Custom components** — `<MyButton>` is left untouched for Preact's standard reconciliation
- **Spread operators** — `<view {...props}>` falls back to runtime dispatch, since the compiler cannot know the keys at build time
- **Dynamic subtrees** — children that mix static elements with custom components are wrapped in runtime-managed "slots"

When the compiler cannot optimize an element, it falls through to the standard Preact code path. Optimized and unoptimized elements coexist in the same render tree — this is by design.

### The compiler preserves semantics

The Snapshot transform is a **pure optimization**. Removing it must produce the same observable result:

> A program should render identically with or without the Snapshot transform applied.

The runtime therefore supports two convergent paths:

- **With transform**: Preact diffs `{ values: [cls] }` → numeric-indexed patches → compiler-generated update functions → Element PAPI
- **Without transform**: Preact diffs `{ className: cls }` → string-keyed patches → runtime string dispatch → Element PAPI

Both paths produce the same Element PAPI calls and therefore the same rendered UI. This semantic equivalence is what makes the compiler safe to adopt incrementally — and testable.

## Motivation

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

produces a virtual DOM tree on every render. The reconciler then diffs every prop on every element — `className` on `<view>`, text content on `<text>`, and so on. This per-prop diffing has real cost, especially on mobile where ReactLynx runs a [dual-threaded architecture](/react/lifecycle): the reconciler runs on a background thread, the UI lives on the main thread, and every change must cross the thread boundary.

Snapshot provides compiler hints that let the runtime skip per-prop diffing for elements it can statically analyze. Dynamic parts are extracted at build time, and the runtime only needs to compare a flat `values` array — one prop instead of many.

## How It Works

### Step 1: Compile — Static/Dynamic Separation

The SWC compiler transforms native JSX elements into **snapshot components**:

```tsx
// Source
<view className={cls}>
  <text>{name}</text>
</view>;
```

```tsx
// Compiled output (simplified)
<__snapshot_a1b2 values={[cls, name]} />;
```

The compiler also generates a **snapshot definition** — a template that tells the runtime how to create the elements and how to update each dynamic part:

```js
// Compiler-generated snapshot definition (simplified)
{
  create(ctx) {
    const view = __CreateView(pageId);
    const text = __CreateText(pageId);
    __AppendElement(view, text);
    return [view, text];
  },

  update: [
    // update[0]: cls → className
    (ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0]),
    // update[1]: name → text content
    (ctx) => __SetAttribute(ctx.__elements[1], 'text', ctx.__values[1]),
  ],
}
```

The key insight: **props like `className` never appear in the runtime diffing path**. They have been compiled into direct [Element PAPI](https://lynxjs.org/api/) calls, indexed by position in the `values` array.

### Step 2: Diff — One Prop Instead of Many

At runtime, Preact sees each snapshot component as having a single prop: `values`.

```
Old render: { values: ["red",  "Alice"] }
New render: { values: ["blue", "Alice"] }
```

Preact's diff detects that `values[0]` changed and calls:

```js
bsi.setAttribute(0, 'blue'); // numeric index, not "className"
```

This operation is recorded as a **patch** for cross-thread delivery. Preact has no knowledge of `className` or `style` — it just shuttles array indices and values.

### Step 3: Patch — Cross the Thread Boundary

After Preact finishes diffing, all accumulated operations are serialized and sent from the background thread to the main thread:

```
Background Thread                     Main Thread
─────────────────                     ───────────
Preact diff
  └─ bsi.setAttribute(0, "blue")
       └─ push to patch array

commit hook fires
  └─ JSON.stringify(patches)  ──IPC──►  snapshotPatchApply()
                                          └─ si.setAttribute(0, "blue")
                                               └─ update[0](si)
                                                    └─ __SetClasses(el, "blue")
```

On the main thread, `setAttribute(0, "blue")` triggers the compiler-generated `update[0]` function, which calls `__SetClasses` directly — no prop name lookup, no switch statement.

### The Full Pipeline

```
<view className={cls}>hello</view>
              │
              ▼  SWC Compiler (build time)
              │
<__snapshot_a1b2 values={[cls]}>hello</__snapshot_a1b2>
+ snapshot_def = {
    create(ctx) { ... },
    update: [(ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0])],
  }
              │
              ▼  Preact diff (background thread)
              │
Compare { values: ["red"] } vs { values: ["blue"] }
→ bsi.setAttribute(0, "blue")
              │
              ▼  Patch serialization + IPC
              │
[SetAttribute, id, 0, "blue"]
              │
              ▼  snapshotPatchApply (main thread)
              │
si.setAttribute(0, "blue")
→ si.__values[0] = "blue"
→ snapshot_def.update[0](si)           // compiler-generated
→ __SetClasses(el, si.__values[0])     // Element PAPI
```

## Preact's Role After Compilation

For compiled elements, Preact's reconciler is reduced to three jobs:

1. **Tree reconciliation** — mount, unmount, reorder (same as standard React)
2. **Values array shuttling** — shallow-diff one prop, forward per-index changes to BSI
3. **Commit hook** — trigger patch flush across threads

Preact never calls `setProperty(element, 'className', value)` for compiled elements — that entire code path is bypassed.

For uncompiled elements (custom components, spreads, dynamic subtrees), Preact performs standard per-prop diffing. The two modes coexist seamlessly:

```
<App>                         ← custom component, standard Preact diff
  <__snapshot_xyz values={…}> ← compiled, values-only diff
    <MyList>                  ← custom component, standard Preact diff
      <__snapshot_abc …>      ← compiled, values-only diff
```

## What Gets Compiled

The compiler classifies each attribute on native elements:

| Category    | Example                     | What happens                                            |
| ----------- | --------------------------- | ------------------------------------------------------- |
| **Static**  | `<view className="header">` | Emitted in the `create` function. Zero update cost.     |
| **Dynamic** | `<view className={cls}>`    | Extracted to `values[i]`. Gets an `update[i]` function. |
| **Spread**  | `<view {...props}>`         | Emits `updateSpread()` — runtime string-key dispatch.   |

### Spread: the runtime fallback

When the compiler encounters a spread (`<view {...props} />`), it cannot statically extract individual attributes. Instead, it generates a call to `updateSpread()`, which dispatches by string key at runtime:

```js
// updateSpread() — simplified
for (const key in newProps) {
  if (key === 'className')       __SetClasses(el, value);
  else if (key === 'style')      __SetInlineStyles(el, value);
  else if (key === 'id')         __SetID(el, value);
  else if (key.startsWith('data-'))  __AddDataset(el, ...);
  else if (eventPattern.test(key))   __AddEvent(el, ...);
  else                           __SetAttribute(el, key, value);
}
```

This is the **only** place in the runtime that maps string property names to Element PAPI methods. It's functional but slower than the compiled path due to string comparisons. Prefer explicit props over spreads in performance-critical code.

## The Two Paths: With and Without the Compiler

Because the transform is a pure optimization, the runtime supports two complete code paths that converge to the same result.

**Path A — With compiler (production):**

```
<view className={cls}>
  → <__snapshot values={[cls]}>
    → bsi.setAttribute(0, newCls)          // numeric index
      → [SetAttribute, id, 0, newCls]      // patch
        → update[0](si)                    // compiler-generated
          → __SetClasses(el, newCls)       // Element PAPI
```

**Path B — Without compiler:**

```
<view className={cls}>
  → createElement("view", { className: cls })
    → bsi.setAttribute("className", cls)   // string key
      → [SetAttribute, id, "className", cls]  // patch
        → runtime string dispatch          // updateSpread-like
          → __SetClasses(el, cls)          // Element PAPI
```

Both paths end at the same `__SetClasses(el, cls)` call. The rendered output is identical.

### Why this matters

Semantic equivalence is not just a theoretical property — it's a **testable invariant**:

- **Incremental adoption** — enable the compiler per-file. Uncompiled and compiled code coexist.
- **Debugging** — disable the transform to isolate compiler bugs from application bugs.
- **Testing without the compiler** — run Preact's upstream test suite through the ReactLynx pipeline _without_ the Snapshot transform. This verifies that the runtime's uncompiled path produces correct results.
- **Testing with the compiler** — the [ReactLynx Testing Library](/react/reactlynx-testing-library) validates the full compiled pipeline end-to-end.

Together, these form a correctness argument: if Path B matches upstream Preact semantics, and Path A matches Path B's output, then Path A is correct.

## Practical Guidance

### Performance

- **Updates are O(1) per changed value** — each dynamic part has a direct function call, no searching or string matching.
- **Unchanged values are free** — `isDirectOrDeepEqual(old, new)` skips the update function entirely.
- **Static attributes cost nothing at update time** — set once in `create`, never re-evaluated.
- **Spreads are slower** — they involve runtime string dispatch. Use explicit props on hot paths.

### What to optimize

Don't worry about:

- The number of static props — they're free at update time
- Prop ordering — has no performance impact
- Element count — only dynamic parts generate update code

Do consider:

- Minimizing frequently-changing dynamic values
- Preferring explicit props over spreads for hot components
- Keeping `values` arrays small in performance-critical subtrees

### Serialization constraints

Patches cross the thread boundary via `JSON.stringify`. Values must be JSON-serializable:

- `NaN` becomes `null`
- `BigInt` throws
- Functions are managed separately by the runtime (event handlers use string identifiers)
- Circular references cause errors

In practice this is rarely an issue — element attributes are typically strings, numbers, or simple objects.

## Comparison

|                  | React                       | Vue 3                         | ReactLynx Snapshot                                |
| ---------------- | --------------------------- | ----------------------------- | ------------------------------------------------- |
| Compiler         | None                        | Patch flags + static hoisting | Full static/dynamic split + codegen               |
| Prop diffing     | Runtime, per-prop           | Runtime, with skip hints      | Compiled: per-index. Uncompiled: per-prop.        |
| Update dispatch  | `setProperty(el, key, val)` | `patchProp` with flags        | `update[i](ctx)` → direct PAPI call               |
| Without compiler | N/A                         | Render functions (full diff)  | Full Preact diff → runtime dispatch → same result |
| Threading        | Single                      | Single                        | Dual-threaded                                     |

Like Vue 3, Snapshot is a compiler-hinted virtual DOM: it preserves the virtual DOM's programming model while using static analysis to skip work. Unlike Vue 3's patch flags (which are hints to the runtime diffing algorithm), ReactLynx generates the update function bodies themselves — a deeper level of compilation made necessary by the dual-threaded architecture, where minimizing cross-thread patch size is critical.

## Summary

Snapshot is the compiler-hinted virtual DOM that powers ReactLynx:

1. **Conservative** — only compiles what can be statically proven safe. Custom components, spreads, and dynamic subtrees fall through to standard Preact diffing.
2. **Semantics-preserving** — the same program produces the same output with or without the transform. This makes the optimization safe, incrementally adoptable, and testable.
3. **Efficient** — compiled elements reduce Preact to a `values` array diff. Each dynamic part gets a direct Element PAPI call with no runtime dispatch.
4. **Dual-thread native** — patches carry indexed values instead of key-value pairs, keeping cross-thread serialization minimal.

You write standard React JSX. The compiler provides hints. The runtime handles both paths.
