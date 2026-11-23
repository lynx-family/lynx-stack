---
name: lynx-runtime
description: Use @lynx-js/lynx-runtime in bundled Lynx projects (ESM /mts & /bts) and build-free .lynxml documents (inline ES2017 IIFE /iife/mts & /iife/bts), including inlining IIFE scripts and testing in node:vm.
---

# Using `@lynx-js/lynx-runtime`

Use this skill when authoring Lynx pages, DSL adapters, or build-free `.lynxml` documents with `@lynx-js/lynx-runtime`.

> **Source of truth (`0.0.x`)**: Read the installed package's `dist/*.d.ts` for exact API signatures and contracts, and `README.md` for host SDK compatibility boundaries.

## 1. Choose an Entrypoint

| Project type                  | Entrypoint                                                                                   | How to load                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bundled Rspeedy / ESM project | `@lynx-js/lynx-runtime/mts`, `@lynx-js/lynx-runtime/bts`, types from `@lynx-js/lynx-runtime` | Standard `import` (`sideEffects: false`)                                               |
| Build-free `.lynxml` document | `@lynx-js/lynx-runtime/iife/mts`, `@lynx-js/lynx-runtime/iife/bts`                           | Inline verbatim from `dist/iife/{mts,bts}.js`; exposes script-scoped `var LynxRuntime` |

For `.lynxml`, always inline the prebuilt ES2017 IIFE instead of loading via blocking `lynx.fetchBundle(...).wait(...)` (which blocks the OS UI thread on cache misses under `ALL_ON_UI` / `PART_ON_LAYOUT`).

## 2. Quick Start for Build-Free `.lynxml`

Read the exact contents of `node_modules/@lynx-js/lynx-runtime/dist/iife/mts.js` and `dist/iife/bts.js` (never retype or hand-edit the minified line) and inline them at the top of `<script thread="main">` and `<script thread="background">`—after any `"use strict";` directive prologue and before any executable code. Wrap each inlined line with `BEGIN`/`END` version comments so future upgrades are easy to spot and replace:

```xml
<!doctype lynx>
<lynx engine-version="4.2">
<script thread="main">
// BEGIN @lynx-js/lynx-runtime iife/mts (<version>)
/* verbatim contents of @lynx-js/lynx-runtime/iife/mts */
// END @lynx-js/lynx-runtime iife/mts
const mts = LynxRuntime;
function mountPage(data) { /* create elements */ }
function onPageUpdate(data, options) { /* update elements */ mts.flushElementTree(options); }
mts.onRenderPage(mountPage);
mts.onUpdateData(onPageUpdate);
</script>
<script thread="background">
// BEGIN @lynx-js/lynx-runtime iife/bts (<version>)
/* verbatim contents of @lynx-js/lynx-runtime/iife/bts */
// END @lynx-js/lynx-runtime iife/bts
const bts = LynxRuntime.bindPage();
bts.onMessage('ready', (payload) => { /* handle MTS message */ });
bts.onDestroy(() => { /* release timers / listeners */ });
</script>
</lynx>
```

## 3. Essential Usage Rules

1. **Avoid reserved top-level `var`/`function` names in classic `<script thread="main">`**: Lazy MTS activation overwrites `globalThis.renderPage`, `updatePage`, and `updateGlobalProps`, and claims `processData`, `getPageData`, and `removeComponents` (installing defaults when missing, or replacing them via `setDataProcessor` / `setPageDataGetter`). Top-level `function` or `var` declarations with those names share `globalThis` (for example, once Runtime is activated by an earlier call, `renderPage` resolves to Runtime's dispatcher and `mts.onRenderPage(renderPage)` recurses). Name page callbacks distinctly (e.g. `mountPage`, `onPageUpdate`).
2. **Keep Runtime as the sole host bridge**: Use `@lynx-js/lynx-runtime` consistently for lifecycle, messaging, `GlobalProps`, global events, and flushing rather than mixing raw `lynx.getEngine()`, `lynx.getJSContext()`, `lynx.getCoreContext()`, `GlobalEventEmitter`, or `__FlushElementTree()` calls on the same page.
3. **Read `onMessage` payloads directly**: `onMessage(type, (data) => ...)` delivers the message `data` directly (not wrapped in `{ type, data }`).
4. **Use `isDestroyed()` in async callbacks, not inside `onDestroy`**: When `onDestroy` callbacks run, `isDestroyed()` is already `true`—run cleanup unconditionally inside `onDestroy`, and guard async callbacks (timers, network, JSB) with `if (isDestroyed()) return;` before calling Runtime APIs.
5. **Check host SDK boundaries for MTS `onDestroy` and BTS `onUpdateData`**: Before relying on MTS teardown hooks or direct BTS `onUpdateData()` delivery on older hosts, verify your target SDK / bundle DSL against `README.md`.

## 4. Unit Testing `.lynxml` in `node:vm`

When executing `.lynxml` scripts in `node:vm` against the inlined IIFE scripts:

- **MTS mock**:
  - Provide `lynx.getNative()` (for `__DestroyLifetime`) alongside `lynx.getEngine()` and `lynx.getJSContext()`.
  - Dispatch engine inputs as `{ data: [payload, options] }`. Construct `options` **inside the VM realm** (for example, `vm.runInContext('({ data: [{}, { timingFlag: "t" }] })', ctx)`) so cross-realm `Object.prototype` checks in `flushElementTree(options)` pass.
- **BTS mock**:
  - Provide `lynx.getApp()` returning an app object with `callDestroyLifetimeFun()`, plus `removeEventListener` on `getCoreContext()` and `removeListener` on `getJSModule()`.
  - Trigger teardown by dispatching `'__DestroyLifetime'` on the `lynx.getNative()` proxy (MTS) and calling `app.callDestroyLifetimeFun()` (BTS).
  - `onMessage` and `onGlobalEvent` return an `Unsubscribe` disposer, and their host-invoked listener wrappers return `undefined` (ignoring async listener Promises), so flush microtasks/turns (`await new Promise(r => setImmediate(r))`) when asserting async handler completion.
