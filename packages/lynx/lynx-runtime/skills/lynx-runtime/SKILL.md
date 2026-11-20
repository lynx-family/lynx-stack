---
name: lynx-runtime
description: Integrate, author, or migrate Lynx pages and build-free .lynxml documents onto @lynx-js/lynx-runtime (ESM /mts & /bts or inline ES2017 IIFE /iife/mts & /iife/bts).
---

# `@lynx-js/lynx-runtime` Integration & Migration

Use this skill when integrating or migrating a Lynx page, DSL adapter, or build-free `.lynxml` document onto `@lynx-js/lynx-runtime`.

> **Preview (`0.0.x`) rule**: Always treat the installed package's `README.md`, `dist/*.d.ts`, and `dist/iife/{mts,bts}.js` as the source of truth for the active version. Do not assume APIs from another version.

## Choose the Entrypoint

| Target environment            | Entrypoint                                                                                   | How to load                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Bundled Rspeedy / ESM project | `@lynx-js/lynx-runtime/mts`, `@lynx-js/lynx-runtime/bts`, types from `@lynx-js/lynx-runtime` | Standard `import` (`sideEffects: false`)                                                               |
| Build-free `.lynxml` document | `@lynx-js/lynx-runtime/iife/mts`, `@lynx-js/lynx-runtime/iife/bts`                           | Inline the prebuilt ES2017 IIFE via `scripts/sync-lynxml.mjs`; exposes script-scoped `var LynxRuntime` |

Do **not** load `@lynx-js/lynx-runtime` via blocking `lynx.fetchBundle(...).wait(...)` on first-screen paths: under UI-thread engine strategies (`ALL_ON_UI` / `PART_ON_LAYOUT`), `.wait()` blocks the OS UI thread and can freeze navigation/exit on cache misses.

## Sync & Verify Build-Free `.lynxml` Files

Never copy minified IIFE lines by hand or run blind search-and-replace across them. Use the package-bundled script so the inline blocks stay byte-for-byte identical to the installed version and guarded by `BEGIN`/`END` markers:

```bash
# Insert or update marked inline IIFE blocks in one or more .lynxml files:
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs path/to/page.lynxml

# Verify byte-for-byte parity, no mixed raw host APIs, and no MTS global-hook collisions:
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs --check path/to/page.lynxml
```

In `<script thread="main">`, bind `const mts = LynxRuntime;` (or use `LynxRuntime.*` directly). In `<script thread="background">`, call `const bts = LynxRuntime.bindPage();` synchronously at top level.

## Migration Checklist (Legacy Raw Host APIs -> `@lynx-js/lynx-runtime`)

Keep migrations **minimal**: swap host lifecycle, peer messaging, global events, and flush glue without rewriting unrelated rendering structure or business protocols in the same change.

### 1. API Mapping

| Legacy raw pattern                                                                                      | `@lynx-js/lynx-runtime` replacement                                                |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| MTS `lynx.getEngine().addEventListener('__RenderPage' \| '__UpdatePage' \| '__UpdateGlobalProps', ...)` | `mts.onRenderPage`, `mts.onUpdateData`, `mts.onReload`, `mts.onGlobalPropsChanged` |
| MTS `globalThis.processData` / `globalThis.getPageData`                                                 | `mts.setDataProcessor` / `mts.setPageDataGetter`                                   |
| MTS `lynx.__globalProps` / `__FlushElementTree()`                                                       | `mts.getGlobalProps()` / `mts.flushElementTree(options?)`                          |
| MTS `lynx.getJSContext()` (`dispatchEvent` / `addEventListener`)                                        | `mts.sendMessage(type, data)` / `mts.onMessage(type, (data) => ...)`               |
| MTS `__DestroyLifetime` + manual `destroyed` flag + `BackgroundDestroy` forwarding                      | `mts.onDestroy(fn)` + `mts.isDestroyed()`                                          |
| BTS `lynx.getCoreContext()` (`dispatchEvent` / `addEventListener`)                                      | `bts.sendMessage(type, data)` / `bts.onMessage(type, (data) => ...)`               |
| BTS `lynx.getJSModule('GlobalEventEmitter')`                                                            | `bts.onGlobalEvent(name, listener)`                                                |
| BTS `lynx.__globalProps` / manual `destroyed` / `BackgroundDestroy` listener                            | `bts.getGlobalProps()` / `bts.isDestroyed()` / `bts.onDestroy(fn)`                 |

### 2. High-Frequency Pitfalls

1. **Classic-script MTS global-hook collision (`.lynxml`)**: When MTS host bindings activate lazily on the first capability call, Runtime writes `globalThis.renderPage`, `updatePage`, `updateGlobalProps`, `processData`, `getPageData`, and `removeComponents`. In a classic `<script thread="main">`, top-level `function renderPage()` or `function updatePage()` declarations share `globalThis` and will be **silently overwritten** (causing infinite recursion if later passed to `mts.onRenderPage(renderPage)`). Rename top-level page callbacks (for example, `mountPage`, `onPageUpdate`).
2. **Synchronous BTS `bindPage()`**: Call `LynxRuntime.bindPage()` synchronously during BTS script evaluation before any async boundary, and retain the returned handle for all async callbacks.
3. **Unwrapped `onMessage` payloads**: `onMessage(type, (data) => ...)` passes `data` directly rather than `{ type, data }`. Update legacy `event.data` reads to `data`.
4. **`onDestroy` runs with `isDestroyed() === true`**: Do **not** guard the top of an `onDestroy` callback with `if (isDestroyed()) return;` (cleanup would never run). Conversely, do guard async callbacks with `if (isDestroyed()) return;` because registering, sending, or flushing after destruction throws.
5. **Forward flush `options`**: Pass the `options` argument from `onUpdateData`, `onReload`, and `onGlobalPropsChanged` through to `mts.flushElementTree(options)` so timing flags and native update metadata are preserved.
6. **Preserve host compatibility boundaries**:
   - MTS `onDestroy` requires `lynx.getNative()` (Lynx SDK 3.4+ / `@lynx-js/web-core` 0.26.9+); earlier hosts degrade to a no-op disposer and `isDestroyed()` stays `false`.
   - BTS `page.onUpdateData()` requires Native `REACT_NODIFF` bundle DSL. If a legacy page forwarded `GlobalProps` or update patches from MTS to BTS, verify target host delivery before removing that forwarding.
7. **Do not mix raw host APIs**: After migrating a page, remove raw `lynx.getEngine()`, `lynx.getJSContext()`, `lynx.getCoreContext()`, `lynx.__globalProps`, `GlobalEventEmitter`, and `__FlushElementTree()` calls from user code.

## Unit Testing in `node:vm`

When testing `.lynxml` scripts in `node:vm` against the inlined IIFEs:

- **MTS mock**:
  - Provide `lynx.getNative()` (for `__DestroyLifetime`) alongside `lynx.getEngine()` and `lynx.getJSContext()`.
  - Dispatch engine inputs as `{ data: [payload, options] }`. Construct `options` **inside the VM realm** (for example, `vm.runInContext('({ data: [{}, { timingFlag: "t" }] })', ctx)`) so cross-realm `Object.prototype` checks in `flushElementTree(options)` pass.
- **BTS mock**:
  - Provide `lynx.getApp()` returning an app object with `callDestroyLifetimeFun()`, plus `removeEventListener` on `getCoreContext()` and `removeListener` on `getJSModule()`.
  - Trigger teardown via `native.__DestroyLifetime()` (MTS) and `app.callDestroyLifetimeFun()` (BTS).
  - `onMessage` and `onGlobalEvent` wrappers return `undefined` (they do not propagate async listener Promises), so flush microtasks/turns (`await new Promise(r => setImmediate(r))`) when asserting async handler completion.
