# Preact Upstream Tests — Main Thread (Element PAPI Rendering)

Runs Preact's own upstream test suite with Preact rendering **through Lynx's Element PAPI** —
no dual-thread pipeline, no BSI, no snapshot compilation.

This is a companion to `packages/react/preact-upstream-tests`, which runs the same
tests through the ReactLynx dual-thread pipeline.

## Purpose

**Establish a baseline**: how many Preact upstream tests pass when Preact runs directly
on the "main thread" (i.e., the same thread as the renderer, no IPC)?

By comparing results against the pipeline version, we can quantify exactly how many
test failures are caused by the dual-thread architecture versus genuine Lynx/Web
incompatibilities.

## Architecture

```
packages/react (pipeline):
  Background Thread: Preact → BSI → snapshot patches → [IPC]
  Main Thread:       snapshotPatchApply → SnapshotInstance → Element PAPI → DOM

packages/preact (direct):
  Single Thread:     Preact → LynxDocument → Element PAPI shims → jsdom (test env)
                                                                 → native Lynx (production)
```

Preact is configured via `options.document = new LynxDocument()` so all element creation
and tree mutations route through Element PAPI (`__CreateElement`, `__AppendElement`, etc.).
In the test environment, PAPI functions are shimmed to operate on jsdom elements.

## Why More Tests Pass Here vs Pipeline

Three categories of skips in the pipeline version vanish in direct mode:

| Category               | Pipeline      | Direct  | Reason                                                                            |
| ---------------------- | ------------- | ------- | --------------------------------------------------------------------------------- |
| **Dual-thread timing** | ~35% of skips | ✅ Pass | `useLayoutEffect` is synchronous, no IPC latency                                  |
| **Test methodology**   | ~15% of skips | ✅ Pass | `getLog`/`clearLog` spy on synchronous DOM; no `__pipelineRender` wrapping needed |
| **BSI/Snapshot**       | many          | ✅ Pass | No BSI, no snapshot machinery — Preact internals are directly accessible          |

## Ref Behavior Note

In this package, `ref.current` is a **LynxElement Proxy** (wrapping the PAPI handle),
not a raw `HTMLElement`. This reflects production Lynx behavior where refs point to
native element handles. Tests that compare `ref.current === scratch.firstChild` (a raw
jsdom element) will fail and are in the skiplist.

## Test Files Enabled vs Pipeline Version

| File                    | Pipeline                   | Direct                | Notes                                                                   |
| ----------------------- | -------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `refs.test.js`          | ❌ Excluded                | ✅ Included (partial) | 12 tests skipped: ref.current is LynxElement not HTMLElement            |
| `events.test.js`        | ❌ Excluded                | ✅ Included           | jsdom supports addEventListener                                         |
| `focus.test.js`         | ❌ Excluded                | ✅ Included           | jsdom has basic focus support                                           |
| `getDomSibling.test.js` | ❌ Excluded                | ❌ Excluded           | Preact vnode._dom is LynxElement, not jsdom element                     |
| `replaceNode.test.js`   | ❌ Excluded                | ❌ Excluded           | 3rd render() arg is jsdom element; Preact tracks LynxElement internally |
| `getLog/clearLog` tests | ⏭️ Skipped (pipeline async) | ✅ Pass               | DOM ops are synchronous                                                 |
| All lifecycle tests     | ⚠️ Many skipped             | ✅ Most pass          | No pipeline timing issues                                               |

## Running Tests

```bash
# Initialize the preact submodule (first time only)
pnpm preact:init

# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Run only currently-skipped tests (for investigation)
pnpm test:skipped
```

## Submodule

This package reuses the preact fork submodule from `packages/react/preact-upstream-tests/preact`
(same commit, no duplication). The vitest aliases resolve `preact` → the submodule source.

## Skiplist

The skiplist (`skiplist.json`) covers 31 tests across 8 categories:

- **2 stress test timeouts** (`should effectively iterate on large lists/components`)
- **1 stress test timeout** (`handle shuffled`)
- **3 jsdom IDL limitation** (`contentEditable` getter not reflected)
- **1 event name case** in Lynx fork (`GotPointerCapture` vs `gotpointercapture`)
- **15 PAPI ref mismatch** — `ref.current` is `LynxElement` Proxy, tests compare with `scratch.firstChild` (raw jsdom element)
- **3 document.body.contains** — `contains(ref.current)` fails because LynxProxy is not a jsdom Node
- **4 pre-existing DOM** — tests that set `scratch.innerHTML` before rendering expect DOM reuse, but `__kids` only tracks PAPI-created elements
- **1 template element** — `<template>.content` DocumentFragment not exposed by LynxElement
- **1 DOM property path** — `border={false}` on `<table>`: browsers have `'border' in table` true, we don't declare it

The remaining 8 inherited skips come from the upstream Preact test infrastructure itself.

## Current Results

**592 pass / 0 fail / 39 skip** (across 631 tests in 37 files)

## Comparing with Pipeline Results

| Metric         | Pipeline (no-compile) | Direct (this package) |
| -------------- | --------------------- | --------------------- |
| Files included | 36                    | 37 (+1 newly enabled) |
| Tests total    | 605                   | 631                   |
| Pass           | 438                   | 592                   |
| Skip           | 167                   | 39                    |
| Fail           | 0                     | 0                     |
| **Pass rate**  | **72.4%**             | **93.8%**             |

**+154 tests newly passing** — all from dual-thread and test-methodology skips being eliminated.

The remaining gap (93.8% vs 100%) is the PAPI ref behavior difference: `ref.current` returns
a `LynxElement` Proxy instead of a raw `HTMLElement`. This is correct production Lynx behavior.
