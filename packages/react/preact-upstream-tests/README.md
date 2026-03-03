# Preact Upstream Tests: E2E Pipeline Verification

Run Preact's own test suite through the **ReactLynx dual-threaded rendering pipeline**
to verify semantic alignment between "Preact rendering to the Web" and
"Preact rendering to Lynx through the Snapshot -> Element PAPI path".

## Dual-Mode Testing

The same test suite runs in **two modes** via Vitest workspace:

| Mode          | Project Name               | What Preact Sees                                 | Primary Purpose                           |
| ------------- | -------------------------- | ------------------------------------------------ | ----------------------------------------- |
| With compiler | `preact-upstream-compiled` | `{ values: ['foo'] }` via SWC snapshot transform | **Primary product-path confidence**       |
| No compiler   | `preact-upstream`          | Raw props `{ className: 'foo' }`                 | Runtime baseline and regression isolation |

The compiler is **conservative** (like Vue 3's compiler-hinted Virtual DOM) — it only
optimizes what it can statically analyze. As an optimization, it should **not change
program semantics**. Both modes' `scratch.innerHTML` should be identical for any given
test. A discrepancy = a bug in the compiler or runtime.

**Current results (compiled)**: 413 pass / 0 fail / 192 skip (across 605 tests in 36 files)
**Current results (no-compiler)**: 438 pass / 0 fail / 167 skip (across 605 tests in 36 files)

### Mode Positioning

- **Default signal for release confidence**: compiled mode (`preact-upstream-compiled`).
- **Baseline and triage tool**: no-compiler mode (`preact-upstream`).
- If a test fails in compiled mode but passes in no-compiler mode, treat it as a likely
  compiler/snapshot-path regression.
- If a test fails in both modes, treat it as a shared runtime/pipeline gap.

No-compiler mode is retained to validate runtime fundamentals independent of the SWC transform:

1. Raw-props path behavior (`setProperty` semantics through BSI shims)
2. Generic snapshot fallback behavior (unknown tag create/update without compiled artifacts)
3. Shared dual-thread runtime stability (commit, patch apply, scratch sync timing)

> Skiplist categories are mode-orthogonal:
>
> - `skip_list` + `permanent_skip_list`: shared by both modes
> - `nocompile_skip_list`: applied only in `preact-upstream`
> - `compiler_skip_list`: applied only in `preact-upstream-compiled`

## Goals and Non-Goals

### Goal: High-Level Operational Semantics

The purpose of this test suite is to confirm that `@lynx-js/react`'s use of Preact
preserves the high-level semantics of upstream Preact:

- Component lifecycle (mount, update, unmount)
- Reconciliation / diffing (keyed reordering, fragment handling, conditional rendering)
- Context propagation (`createContext`, nested providers, consumer updates)
- State management (`setState` batching, callbacks, functional updates)
- Ref forwarding and callback refs
- Error boundaries
- `shouldComponentUpdate` / `PureComponent` behavior

Tests that **pass** = alignment confirmed.
Tests that **fail** = semantic gap that needs investigation.

### Non-Goal: Web DOM Specifics

Lynx is not a web browser. Many Preact tests assert behaviors that depend on web-specific
APIs and conventions that are **structurally absent** in the Lynx platform. These tests are
**non-goals** — they don't tell us anything about whether our Preact fork preserves the
rendering semantics we care about.

Categories of non-goals (managed via `skiplist.json`):

1. **DOM mutation order** (`getLog`/`clearLog`): Tests that assert the exact sequence
   of `appendChild`/`removeChild`/`insertBefore` calls. The Lynx pipeline routes through
   a `<page>` root element, producing structurally different (but semantically equivalent)
   mutation sequences. (~77 tests)

2. **`dangerouslySetInnerHTML`**: Lynx Element PAPI has no `innerHTML` equivalent.
   (~7 tests)

3. **`MutationObserver`**: Lynx environment does not provide this API. (~2 tests)

4. **Web DOM IDL properties**: Preact's `setProperty()` sets DOM properties like
   `element.value`, `element.checked`, `element.contentEditable` directly (`dom[prop] = val`).
   BSI has no IDL property layer, so these take a different code path. (~9 tests)

5. **Boolean-to-attribute serialization**: Web convention (`true->''`, `false->remove`)
   vs Lynx convention — not relevant to Element PAPI. (~3 tests)

6. **JSON serialization limits**: `NaN`, `BigInt`, objects with custom `toString()` are
   lost during `JSON.stringify` in the BSI->patch IPC boundary. (~6 tests)

7. **`component.base` / Refs as DOM nodes**: Tests that expect `component.base` or refs
   to return real DOM nodes. In Lynx, these return BSI (background thread objects). (~14 tests)

8. **Direct DOM mutation**: Tests that mutate jsdom directly and expect Preact to detect
   the change — BSI has no access to main-thread DOM state. (permanent skip)

9. **Event registration** (`events.test.js`): Tests spy on DOM `element.addEventListener`
   but BSI event stubs register on the background thread and never reach jsdom. Lynx has
   its own event model separate from the Web DOM event system. (permanent skip)

10. **Focus / selection** (`focus.test.js`): Tests call `element.focus()` and
    `setSelectionRange()` via `document.activeElement`. Lynx has its own focus model.
    (permanent skip, except `should maintain focus when hydrating` which passes in no-compiler mode)

11. **Dual-thread lifecycle DOM timing**: Tests that read DOM state synchronously inside
    lifecycle hooks (`componentWillMount`, `getSnapshotBeforeUpdate`, etc.). In the dual-thread
    model the background thread cannot observe main-thread DOM state mid-commit. (~5 tests)

12. **Preact internals** (`getDomSibling.test.js`): Tests import and directly invoke
    Preact's internal `getDomSibling()` algorithm, walking `dom._children` VNode attachment.
    Our pipeline renders to `globalThis.__root` (BSI), not to `scratch`, so `scratch._children`
    is always `undefined`. These test Preact's internal algorithm, not rendering semantics.
    (excluded entirely)

13. **`replaceNode` parameter** (`replaceNode.test.js`): Tests pre-populate jsdom with
    raw HTML and then call `render(jsx, container, replaceNode)` to reuse/replace specific
    nodes. Requires `dom._children` internal VNode state and is web-specific (no SSR reuse
    in Lynx). (excluded entirely)

## Test Subsetting via `skiplist.json`

Inspired by the Hermes test runner, we use a structured `skiplist.json` to declaratively manage
which tests are excluded and why.

### Structure

```jsonc
{
  // Keyword-based: scan each it() body for these keywords, auto-skip if found
  "unsupported_features": [
    {
      "keywords": ["getLog", "clearLog"],
      "comment": "DOM mutation order — ...",
      "skipped_count": 77 // approximate, for documentation
    }
  ],

  // Manual: skip specific tests by exact name match
  "skip_list": [
    {
      "tests": ["test name 1", "test name 2"],
      "comment": "Reason these are skipped"
    }
  ],

  // No-compiler-only: fails in preact-upstream, passes in preact-upstream-compiled
  "nocompile_skip_list": [
    {
      "tests": ["test name"],
      "comment": "No-compile specific gap"
    }
  ],

  // Compiler-only: fails in preact-upstream-compiled, passes in preact-upstream
  "compiler_skip_list": [
    {
      "tests": ["test name"],
      "comment": "Compile-only semantic gap"
    }
  ],

  // Permanent: fundamentally incompatible, never expected to pass
  "permanent_skip_list": [
    {
      "tests": ["test name"],
      "comment": "Reason this will never work"
    }
  ]
}
```

### How It Works

A Vite transform plugin (`preact-skiplist` in `vitest.config.ts`) processes each test
file at build time:

1. **Keyword scanning**: For each `it()` block, the plugin extracts the full body text
   and checks against `unsupported_features[].keywords` using word-boundary regex.
   If any keyword matches, `it(` is rewritten to `it.skip(`.

2. **Manual skip**: The test name (first string argument to `it()`) is checked against:
   - shared: `skip_list` + `permanent_skip_list`
   - no-compiler-only: `nocompile_skip_list` (only in `preact-upstream`)
   - compiled-only: `compiler_skip_list` (only in `preact-upstream-compiled`)
     Exact match -> `it.skip(`.

This approach means:

- **No upstream test modifications** — the submodule stays pristine
- **Self-documenting** — every skip has a `comment` explaining why
- **Easy to audit** — `skipped_count` shows the blast radius of each keyword
- **Easy to evolve** — as Lynx gains features, remove entries and watch tests pass

### Decision: `skip_list` vs `nocompile_skip_list` vs `compiler_skip_list` vs `permanent_skip_list`

- **`skip_list`**: Tests that _could_ pass someday if we bridge the gap (e.g., BSI IDL
  properties, JSON serialization). We keep them separate to track potential future work.
- **`nocompile_skip_list`**: Tests that fail only in no-compiler mode and already pass
  in compiled mode.
- **`permanent_skip_list`**: Tests that are _structurally impossible_ in Lynx (e.g.,
  direct DOM mutation, `<template>.content`). No point tracking these as future work.
- **`compiler_skip_list`**: Tests that fail **only in compiled mode**. Applied only when
  running the `preact-upstream-compiled` project. These are _not_ tag-name issues (real
  HTML tags are preserved — see Architecture below), but rather structural differences
  in compiler output:
  - `<wrapper>` elements around text expressions (~29 tests)
  - Serialized event attributes in `innerHTML` (~4 tests)
  - Changed `render()` return value signature (~10 tests)
  - Boolean attributes baked into `create()` (~4 tests)
  - DOM IDL properties via `values` array (~3 tests)
  - Keyed hole operations with changed component identity (~4 tests)

## Architecture

Both modes share the same dual-thread pipeline infrastructure. The difference is
**what Preact sees as VNodes** and **how attributes reach Element PAPI**.

### Compiled Mode (`preact-upstream-compiled`)

The SWC snapshot transform compiles JSX ahead of time. Instead of raw props, Preact
sees `{ values: ['foo'] }` and a snapshot type like `"__snapshot_a1b2c3"`. Attribute
dispatch happens via compiler-generated **`update` functions** instead of `applyViaElementPAPI`.

```
Build Time (SWC)
================
<div className={cls}>hello</div>
      │
      ▼  snapshot transform
_jsx("__snapshot_a1b2c3", { values: [cls] })
+
registerSnapshot("__snapshot_a1b2c3", {
  create() { __CreateElement("div", pageId) },  ← real HTML tag preserved!
  update: [
    (ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0])
  ]
})
```

```
 Background Thread                         Main Thread
 ========================                  ======================

 Preact diff/render                        snapshotPatchApply()
       │                                         │
       ▼                                         ▼
 VNode { type: "__snapshot_a1b2c3",       SnapshotInstance
         props: { values: [cls] } }        ├─ insertBefore(child)
       │                                   │   └─ ensureElements()
       ▼                                   │       └─ snapshot.create()
 BackgroundSnapshotInstance                │           └─ __CreateElement("div")
  ├─ setAttribute("values", [cls])         ├─ setAttribute("values", [cls])
  │   └─ pushes to patch array             │   └─ snapshot.update[0](ctx)
  │       key="values", val=[cls]          │       └─ __SetClasses(el, cls)
  └─ (same tree ops as no-compiler)        └─ __elements[0] ← <div> jsdom node
       │                                         │
       ▼                                         ▼
 (same patch IPC as no-compiler)          Element PAPI (jsdom)
                                           └─ same __CreateElement / __SetClasses / etc.
```

Key difference: Preact never calls `setProperty(bsi, 'className', cls)`. Instead it
calls `setAttribute("values", [cls])`, and the **compiler-generated `update` function**
maps `values[0]` → `__SetClasses(el, cls)`. This is the same path production
ReactLynx uses.

### No-Compiler Mode (`preact-upstream`) — Runtime Baseline

Preact sees raw props (`{ className: 'foo' }`) and diffs them directly. Attribute
changes go through BSI shims → patch IPC → `applyViaElementPAPI()` on the main thread.
This mode is intentionally kept as a runtime baseline and regression-isolation tool.

```
 Background Thread                         Main Thread
 ========================                  ======================

 Preact diff/render                        snapshotPatchApply()
       │                                         │
       ▼                                         ▼
 BackgroundSnapshotInstance               SnapshotInstance
  ├─ insertBefore(child)                  ├─ insertBefore(child)
  ├─ removeChild(child)                   │   └─ ensureElements()
  ├─ setAttribute(key, val)               │       └─ __CreateElement(tag)
  │   └─ pushes to patch array            ├─ setAttribute(key, val)
  └─ BSI shims:                           │   └─ applyViaElementPAPI(el,k,v)
      ├─ .style proxy -> SetAttribute     │       ├─ __SetClasses
      ├─ .addEventListener (stub)         │       ├─ __SetInlineStyles
      ├─ .removeEventListener (stub)      │       ├─ __SetID / __AddDataset
      ├─ .dispatchEvent (stub)            │       └─ __SetAttribute
      └─ .removeAttribute (stub)          └─ __elements[0] ← jsdom node
       │                                         │
       ▼                                         ▼
 __globalSnapshotPatch[]                  Element PAPI (jsdom)
  [CreateElement, type, id]               ├─ __CreateElement(tag)
  [InsertBefore, parent, child, before]   ├─ __AppendElement(parent, child)
  [SetAttribute, id, key, value]          ├─ __InsertElementBefore(...)
  [RemoveChild, parent, child]            └─ __RemoveElement(parent, child)
       │                                         │
       ▼                                         ▼
 commitPatchUpdate()                      vitest jsdom document
  └─ JSON.stringify(patchList)                    │
       │                                         ▼
       └──── callLepusMethod ──────►       syncSnapshotToScratch()
              (IPC simulation)              └─ move children from
              switches thread                  <page> to scratch div
```

In this mode, `__CreateElement(tag)` receives the **real HTML tag** (e.g. `"div"`)
because the generic snapshot factory passes through the tag name directly.

### snapshotCreatorMap: Bridging Compiler Definitions to Both Threads

`snapshotCreatorMap` is a **module-level singleton** shared between simulated threads.
When the SWC-compiled test module is imported, it calls `registerSnapshot()` which
populates `snapshotCreatorMap["__snapshot_a1b2c3"] = (type) => { ... }`.

The `setup.js` monkey-patch on `snapshotManager.values.has/get` checks
`snapshotCreatorMap[type]` **before** falling back to the generic snapshot factory:

```
snapshotManager.values.has(type)
  → snapshotCreatorMap[type] exists?
    → YES: invoke creator (registers real snapshot with create/update functions)
    → NO:  register generic snapshot (create calls __CreateElement(type))
```

This ensures that in compiled mode, `__CreateElement` receives the **real HTML tag**
(from the compiler's `create()` function) rather than the snapshot type name.

### Key Design Decisions

1. **Element PAPI dispatch** (not direct jsdom writes): Both modes route attribute
   changes through Element PAPI (`__SetClasses`, `__SetInlineStyles`, `__SetAttribute`,
   etc.). No-compiler mode does this via `applyViaElementPAPI()`. Compiled mode does
   this via compiler-generated `update` functions. Both exercise the real
   SI->Element PAPI->jsdom path.

2. **Shared jsdom instance**: Element PAPI and the test scratch container use the
   same jsdom document (vitest's built-in jsdom environment). This allows direct
   DOM node moves between the `<page>` element and the test's scratch div.

3. **Generic Snapshot factory** (no-compiler mode): Preact tests use arbitrary HTML
   tags (`div`, `span`, `p`, etc.) which don't have compiler-generated definitions.
   A generic snapshot is auto-registered for any unknown element type via
   monkey-patching `snapshotManager.values.has/get`.

4. **Compiler snapshot priority** (compiled mode): When `snapshotCreatorMap` has an
   entry for a type, the monkey-patch invokes the compiler's creator instead of
   generating a generic snapshot. This preserves real HTML tags and typed `update`
   functions.

5. **BSI shims** (no-compiler mode only): Preact's `setProperty()` tries
   `dom[name] = value` first, but since `'className' in bsi === false`, it falls
   through to `dom.setAttribute(name, value)`. Only `style`, events, and
   `removeAttribute` need shims. In compiled mode these shims are not exercised
   because Preact only sets `values` — never individual props.

6. **Render transform**: A Vite plugin rewrites `render(` -> `__pipelineRender(` in
   test files so that Preact's render calls go through the full dual-thread pipeline
   instead of directly to DOM. Shared by both modes.

7. **Option name bridging**: Upstream Preact uses `options._commit` while the
   ReactLynx-forked Preact uses `options.__c` (mangled). A `defineProperty`
   getter/setter bridges the two.

### Vite Plugin Pipeline

The two modes share most plugins but differ in whether the SWC snapshot transform runs:

**Compiled mode** (`preact-upstream-compiled`):

1. `preact-snapshot-transform` — JSX → snapshot definitions + `_jsx()` calls (SWC)
2. `preact-pipeline-render` — `render(` → `__pipelineRender(`
3. `preact-skiplist` — `it(` → `it.skip(` (shared + `compiler_skip_list`)
4. esbuild — no-op (no JSX remaining after SWC)

**No-compiler mode** (`preact-upstream`):

1. `preact-pipeline-render` — `render(` → `__pipelineRender(`
2. `preact-skiplist` — `it(` → `it.skip(` (shared + `nocompile_skip_list`)
3. esbuild JSX transform — JSX → `createElement()` calls

## Managing the Preact submodule (upstream)

The `preact/` directory is a **git submodule** that points to the Lynx fork of Preact
(branch `lynx/v10.24.x`). You must initialize or update it before running tests.

| Script               | Description                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm preact:init`   | Initialize the submodule (first-time clone or after a fresh repo clone). Run from this package or from repo root. |
| `pnpm preact:update` | Update the submodule to the latest commit on the tracked branch.                                                  |
| `pnpm preact:status` | Show the current submodule commit and whether it is dirty.                                                        |

**First-time setup** (from repo root or from this package):

```bash
# From this package
pnpm preact:init

# Or from repo root
git submodule update --init packages/react/preact-upstream-tests/preact
```

**Clone the whole repo with submodules:**

```bash
git clone --recurse-submodules <repo-url>
```

If you already cloned without `--recurse-submodules`, run `pnpm preact:init` once from
`packages/react/preact-upstream-tests` (or the equivalent `git submodule update --init`
from repo root).

**Updating upstream:** To pull the latest Preact changes from the Lynx fork:

```bash
pnpm preact:update
```

Then run tests and commit the updated submodule reference if needed.

## Running

Ensure the Preact submodule is initialized (see above), then from this package:

```bash
# Primary signal (recommended in daily work)
pnpm test:compiled

# Baseline / regression isolation
pnpm test:no-compile

# Full matrix (both modes)
pnpm test
```

Recommended workflow:

1. Run `pnpm test:compiled` first.
2. If something fails, run `pnpm test:no-compile` to determine whether the issue is
   compiler-path-specific or shared runtime behavior.
3. Use `SKIPLIST_ONLY` to isolate specific skip groups while investigating.

### Investigating Skipped Tests (`SKIPLIST_ONLY`)

To run **only** the skipped tests (instead of skipping them), use the `SKIPLIST_ONLY`
environment variable. This inverts the skiplist plugin: specified tests run normally,
everything else is skipped.

```bash
# Run all tests from skip_list + nocompile_skip_list (no-compiler mode)
pnpm test:skipped

# Run all tests from skip_list + compiler_skip_list (compiled mode)
pnpm test:skipped:compiled

# Run a specific category
SKIPLIST_ONLY=permanent_skip_list pnpm test:no-compile

# Run a specific group within a category (0-indexed)
SKIPLIST_ONLY=skip_list:0 pnpm test:no-compile     # NaN/BigInt serialization group
SKIPLIST_ONLY=skip_list:3 pnpm test:no-compile     # component.base semantics group

# Run unsupported_features keyword group
SKIPLIST_ONLY=unsupported_features:2 pnpm test:no-compile  # dangerouslySetInnerHTML

# Run no-compile-only group
SKIPLIST_ONLY=nocompile_skip_list:1 pnpm test:no-compile   # boolean attribute semantics

# Combine multiple categories/groups (comma-separated)
SKIPLIST_ONLY=skip_list:0,skip_list:1 pnpm test:no-compile
SKIPLIST_ONLY=skip_list,nocompile_skip_list pnpm test:no-compile
SKIPLIST_ONLY=skip_list,permanent_skip_list pnpm test:no-compile
```

**Valid categories**: `unsupported_features`, `skip_list`, `nocompile_skip_list`, `permanent_skip_list`, `compiler_skip_list`

Each category corresponds to a top-level key in `skiplist.json`. The optional `:N` suffix
selects a specific group (0-indexed array position) within that category.

Use this to investigate _why_ tests are skipped — run them, see the actual failure output,
and determine if the gap can be bridged.

**Tip for AI agents**: When investigating skipped tests, prefer running
`SKIPLIST_ONLY=skip_list:N pnpm test:no-compile` and reading the terminal output over
manually reading test source files. The test runner output shows exact assertion failures
with expected vs actual values, which is far more informative (and cheaper on context)
than trying to trace through test code manually. Use the group index (`:N`) to narrow
down to a small batch of related failures.
