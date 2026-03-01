# Preact Upstream Tests: E2E Pipeline Verification

Run Preact's own test suite through the **ReactLynx dual-threaded rendering pipeline**
to verify semantic alignment between "Preact rendering to the Web" and
"Preact rendering to Lynx through the Snapshot -> Element PAPI path".

**Current results**: 203 pass / 0 fail / 107 skip (across 310 tests in 5 files)

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

2. **Manual skip**: The test name (first string argument to `it()`) is checked against
   the union of `skip_list` and `permanent_skip_list`. Exact match -> `it.skip(`.

This approach means:

- **No upstream test modifications** — the submodule stays pristine
- **Self-documenting** — every skip has a `comment` explaining why
- **Easy to audit** — `skipped_count` shows the blast radius of each keyword
- **Easy to evolve** — as Lynx gains features, remove entries and watch tests pass

### Decision: `skip_list` vs `permanent_skip_list`

- **`skip_list`**: Tests that _could_ pass someday if we bridge the gap (e.g., BSI IDL
  properties, JSON serialization). We keep them separate to track potential future work.
- **`permanent_skip_list`**: Tests that are _structurally impossible_ in Lynx (e.g.,
  direct DOM mutation, `<template>.content`). No point tracking these as future work.

## Architecture

```
 Background Thread                         Main Thread
 ========================                  ======================

 Preact diff/render                        snapshotPatchApply()
       │                                         │
       ▼                                         ▼
 BackgroundSnapshotInstance               SnapshotInstance
  ├─ insertBefore(child)                  ├─ insertBefore(child)
  ├─ removeChild(child)                   │   └─ ensureElements()
  ├─ setAttribute(key, val)               │       └─ __CreateElement(type)
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

### Key Design Decisions

1. **Element PAPI dispatch** (not direct jsdom writes): `applyViaElementPAPI()` routes
   attribute patches through the same `__SetClasses`, `__SetInlineStyles`, `__SetAttribute`
   etc. methods that production Lynx uses. This ensures the test exercises the real
   SI->Element PAPI->jsdom path, not a shortcut.

2. **Shared jsdom instance**: Element PAPI and the test scratch container use the
   same jsdom document (vitest's built-in jsdom environment). This allows direct
   DOM node moves between the `<page>` element and the test's scratch div.

3. **Generic Snapshot factory**: Preact tests use arbitrary HTML tags (`div`, `span`,
   `p`, etc.) which don't have compiler-generated Snapshot definitions. A generic
   snapshot is auto-registered for any unknown element type via monkey-patching
   `snapshotManager.values.has/get`.

4. **BSI shims**: Preact's `setProperty()` tries `dom[name] = value` first, but since
   `'className' in bsi === false`, it falls through to `dom.setAttribute(name, value)`
   which BSI natively supports. Only `style`, events, and `removeAttribute` need shims.

5. **Render transform**: A Vite plugin rewrites `render(` -> `__pipelineRender(` in test
   files so that Preact's render calls go through the full dual-thread pipeline instead
   of directly to DOM. The transform is careful to skip class method definitions
   (`render() {`), property access (`.render(`), and other non-call-site uses.

6. **Option name bridging**: Upstream Preact uses `options._commit` while the
   ReactLynx-forked Preact uses `options.__c` (mangled). A `defineProperty`
   getter/setter bridges the two.

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
pnpm test
# or
npx vitest run
```
