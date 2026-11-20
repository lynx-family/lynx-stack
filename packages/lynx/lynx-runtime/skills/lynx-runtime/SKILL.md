---
name: lynx-runtime
description: Integrate, author, or migrate Lynx pages and build-free .lynxml documents onto @lynx-js/lynx-runtime (ESM /mts & /bts or inline ES2017 IIFE /iife/mts & /iife/bts).
---

# `@lynx-js/lynx-runtime` Integration & Migration

Use this skill when integrating or migrating a Lynx page, DSL adapter, or build-free `.lynxml` document onto `@lynx-js/lynx-runtime`.

> **Source of truth (`0.0.x`)**: Read the installed package's `dist/*.d.ts` for exact API signatures/contracts and `README.md` for host SDK compatibility boundaries. This skill covers workflow, migration mapping, and traps not obvious from the types alone.

## Choose the Entrypoint

| Target environment            | Entrypoint                                                                                   | How to load                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Bundled Rspeedy / ESM project | `@lynx-js/lynx-runtime/mts`, `@lynx-js/lynx-runtime/bts`, types from `@lynx-js/lynx-runtime` | Standard `import` (`sideEffects: false`)                                                               |
| Build-free `.lynxml` document | `@lynx-js/lynx-runtime/iife/mts`, `@lynx-js/lynx-runtime/iife/bts`                           | Inline the prebuilt ES2017 IIFE via `scripts/sync-lynxml.mjs`; exposes script-scoped `var LynxRuntime` |

Do **not** load `@lynx-js/lynx-runtime` via blocking `lynx.fetchBundle(...).wait(...)` on first-screen paths: under UI-thread engine strategies (`ALL_ON_UI` / `PART_ON_LAYOUT`), `.wait()` blocks the OS UI thread and can freeze navigation/exit on cache misses.

## Sync & Verify Build-Free `.lynxml` Files

Never copy minified IIFE lines by hand or run blind search-and-replace across them. Use the bundled script so inline blocks stay byte-for-byte identical to the installed version and guarded by `BEGIN`/`END` markers:

```bash
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs path/to/page.lynxml
node node_modules/@lynx-js/lynx-runtime/skills/lynx-runtime/scripts/sync-lynxml.mjs --check path/to/page.lynxml
```

In `<script thread="main">`, bind `const mts = LynxRuntime;` (or call `LynxRuntime.*`). In `<script thread="background">`, call `const bts = LynxRuntime.bindPage();` synchronously at top level and retain `bts` for all async callbacks.

## Migration Checklist (Legacy Raw Host APIs -> `@lynx-js/lynx-runtime`)

Keep migrations **minimal**: swap host lifecycle, peer messaging, global events, and flush glue without rewriting unrelated rendering structure or business protocols in the same change.

### 1. API Mapping

| Legacy raw pattern                                                                                      | `@lynx-js/lynx-runtime` replacement                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| MTS `lynx.getEngine().addEventListener('__RenderPage' \| '__UpdatePage' \| '__UpdateGlobalProps', ...)` | `mts.onRenderPage`, `mts.onUpdateData`, `mts.onReload`, `mts.onGlobalPropsChanged`     |
| MTS `globalThis.processData` / `globalThis.getPageData`                                                 | `mts.setDataProcessor` / `mts.setPageDataGetter`                                       |
| MTS `lynx.__globalProps` / `__FlushElementTree()`                                                       | `mts.getGlobalProps()` / `mts.flushElementTree(options?)` (forward callback `options`) |
| MTS `lynx.getJSContext()` (`dispatchEvent` / `addEventListener`)                                        | `mts.sendMessage(type, data)` / `mts.onMessage(type, (data) => ...)`                   |
| MTS `__DestroyLifetime` + manual `destroyed` flag + `BackgroundDestroy` forwarding                      | `mts.onDestroy(fn)` + `mts.isDestroyed()`                                              |
| BTS `lynx.getCoreContext()` (`dispatchEvent` / `addEventListener`)                                      | `bts.sendMessage(type, data)` / `bts.onMessage(type, (data) => ...)`                   |
| BTS `lynx.getJSModule('GlobalEventEmitter')`                                                            | `bts.onGlobalEvent(name, listener)`                                                    |
| BTS `lynx.__globalProps` / manual `destroyed` / `BackgroundDestroy` listener                            | `bts.getGlobalProps()` / `bts.isDestroyed()` / `bts.onDestroy(fn)`                     |

### 2. Migration-Specific Pitfalls

1. **Classic-script MTS global-hook collision (`.lynxml`)**: Lazy MTS activation writes `globalThis.renderPage`, `updatePage`, `updateGlobalProps`, `processData`, `getPageData`, and `removeComponents`. In classic `<script thread="main">`, top-level `function renderPage()` / `updatePage()` declarations share `globalThis` and are **silently overwritten** (causing infinite recursion if passed to `mts.onRenderPage(renderPage)`). Rename them (e.g. `mountPage`, `onPageUpdate`).
2. **Unwrapped `onMessage` payload**: Unlike raw `addEventListener(type, (e) => e.data)`, `onMessage(type, (data) => ...)` passes `data` directly; update legacy `e.data` reads.
3. **Teardown guard inversion**: `isDestroyed()` is already `true` when `onDestroy` callbacks run. Remove legacy `if (destroyed) return;` guards from the top of `onDestroy` handlers, while keeping `if (isDestroyed()) return;` in async callbacks before sending, registering, or flushing.
4. **Verify host compatibility before deleting legacy bridges**: Check `README.md` (`Package and host versions` & `Native data processing & host updates`) before relying on MTS `onDestroy` on older SDKs or removing legacy MTS-to-BTS `updateData` / `GlobalProps` forwarding.
5. **Run `--check` after migrating**: `sync-lynxml.mjs --check` catches drifted inline blocks, leftover raw host APIs, and top-level MTS hook collisions.

## Unit Testing in `node:vm`

When testing `.lynxml` scripts in `node:vm` against the inlined IIFEs:

- **MTS mock**:
  - Provide `lynx.getNative()` (for `__DestroyLifetime`) alongside `lynx.getEngine()` and `lynx.getJSContext()`.
  - Dispatch engine inputs as `{ data: [payload, options] }`. Construct `options` **inside the VM realm** (for example, `vm.runInContext('({ data: [{}, { timingFlag: "t" }] })', ctx)`) so cross-realm `Object.prototype` checks in `flushElementTree(options)` pass.
- **BTS mock**:
  - Provide `lynx.getApp()` returning an app object with `callDestroyLifetimeFun()`, plus `removeEventListener` on `getCoreContext()` and `removeListener` on `getJSModule()`.
  - Trigger teardown via `native.__DestroyLifetime()` (MTS) and `app.callDestroyLifetimeFun()` (BTS).
  - `onMessage` and `onGlobalEvent` wrappers return `undefined` (they do not propagate async listener Promises), so flush microtasks/turns (`await new Promise(r => setImmediate(r))`) when asserting async handler completion.
