---
name: lynx-runtime
description: Use @lynx-js/lynx-runtime in bundled Lynx projects (ESM /mts & /bts) and build-free .lynxml documents (inline ES2017 IIFE /iife/mts & /iife/bts), including syncing .lynxml inline blocks and testing in node:vm.
---

# Using `@lynx-js/lynx-runtime`

Use this skill when authoring Lynx pages, DSL adapters, or build-free `.lynxml` documents with `@lynx-js/lynx-runtime`.

> **Source of truth (`0.0.x`)**: Read the installed package's `dist/*.d.ts` for exact API signatures and contracts, and `README.md` for host SDK compatibility boundaries.

## 1. Choose an Entrypoint

| Project type                  | Entrypoint                                                                                   | How to load                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bundled Rspeedy / ESM project | `@lynx-js/lynx-runtime/mts`, `@lynx-js/lynx-runtime/bts`, types from `@lynx-js/lynx-runtime` | Standard `import` (`sideEffects: false`)                                                    |
| Build-free `.lynxml` document | `@lynx-js/lynx-runtime/iife/mts`, `@lynx-js/lynx-runtime/iife/bts`                           | Inline via `scripts/sync-lynxml.mjs`; exposes script-scoped `var LynxRuntime` on each block |

For `.lynxml`, always inline the prebuilt ES2017 IIFE instead of loading via blocking `lynx.fetchBundle(...).wait(...)` (which blocks the OS UI thread on cache misses under `ALL_ON_UI` / `PART_ON_LAYOUT`).

## 2. Quick Start for Build-Free `.lynxml`

Write your page logic against `LynxRuntime` and let the bundled script insert/update the marked inline IIFE blocks (never copy or search-and-replace minified IIFE lines by hand):

```xml
<!doctype lynx>
<lynx engine-version="4.2">
<script thread="main">
const mts = LynxRuntime;
function mountPage(data) { /* create elements */ }
function onPageUpdate(data, options) { /* update elements */ mts.flushElementTree(options); }
mts.onRenderPage(mountPage);
mts.onUpdateData(onPageUpdate);
</script>
<script thread="background">
const bts = LynxRuntime.bindPage();
bts.onMessage('ready', (payload) => { /* handle MTS message */ });
bts.onDestroy(() => { /* release timers / listeners */ });
</script>
</lynx>
```

Then sync and verify the inline blocks against the installed package version:

```bash
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs path/to/page.lynxml
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs --check path/to/page.lynxml
```

## 3. Essential Usage Rules

1. **Avoid reserved top-level names in classic `<script thread="main">`**: Lazy MTS activation binds `globalThis.renderPage`, `updatePage`, `updateGlobalProps`, `processData`, `getPageData`, and `removeComponents`. Top-level declarations with those names in a classic script share `globalThis` and will be overwritten (causing infinite recursion if passed to `mts.onRenderPage(renderPage)`). Name page callbacks distinctly (e.g. `mountPage`, `onPageUpdate`).
2. **Keep Runtime as the sole host bridge**: Use `@lynx-js/lynx-runtime` consistently for lifecycle, messaging, `GlobalProps`, global events, and flushing rather than mixing raw `lynx.getEngine()`, `lynx.getJSContext()`, `lynx.getCoreContext()`, `GlobalEventEmitter`, or `__FlushElementTree()` calls on the same page (`sync-lynxml.mjs --check` enforces this for `.lynxml`).
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
  - Trigger teardown via `native.__DestroyLifetime()` (MTS) and `app.callDestroyLifetimeFun()` (BTS).
  - `onMessage` and `onGlobalEvent` wrappers return `undefined` (they do not propagate async listener Promises), so flush microtasks/turns (`await new Promise(r => setImmediate(r))`) when asserting async handler completion.
