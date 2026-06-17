# @lynx-js/cache-events-webpack-plugin

## 0.1.0

### Minor Changes

- **BREAKING CHANGE** ([#2803](https://github.com/lynx-family/lynx-stack/pull/2803))

  Drop webpack support — the plugins now target Rspack only. All public types come from `@rspack/core` instead of `webpack` (e.g. `Compiler`, `Compilation`, `LoaderContext`), and the `webpack` dependency is removed.

### Patch Changes

- Fix a memory leak in the cache-events runtime where the `tt` / `globalThis` method mocks were never uninstalled after all chunks loaded. ([#2774](https://github.com/lynx-family/lynx-stack/pull/2774))

  The mock functions installed on `globalThis.loadDynamicComponent` and `tt[...]` were left in place after `loaded` became `true`. Because they stayed reachable from `globalThis` / `tt`, their closures pinned the whole cache machinery (`lynx_ce`, `setupList`, the captured `tt` / `GlobalEventEmitter` and the original bound functions) for the entire app lifetime.

  The replay functions now restore the original methods (guarded so they only revert their own mocks), `onLoaded` clears `cleanupList`, and `setupList` is reset so the setup closures can be collected.

- Prefix Lynx runtime module names with `webpack/runtime/` (e.g. `Lynx async chunks` → `webpack/runtime/lynx async chunks`), matching the path-structured naming of the bundler's built-in runtime modules. The previous bare names had no path segment, so when they appear as a source-map `sources` entry under a `file://` module-filename template they collapsed into an invalid URL authority (the space-containing name became the host) and broke `SourceMapConsumer` parsing. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

## 0.0.3

### Patch Changes

- Cache `globalThis.loadDynamicComponent` in the cache events runtime and add tests covering tt methods, performance events, and globalThis replay behavior. ([#2343](https://github.com/lynx-family/lynx-stack/pull/2343))

## 0.0.2

### Patch Changes

- Fix that `__webpack_require__.lynx_ce` is incorrectly injected when lazy bundle is enabled. ([#1616](https://github.com/lynx-family/lynx-stack/pull/1616))

## 0.0.1

### Patch Changes

- Add new `LynxCacheEventsPlugin`, which will cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready. ([#1370](https://github.com/lynx-family/lynx-stack/pull/1370))

- Updated dependencies [[`aaca8f9`](https://github.com/lynx-family/lynx-stack/commit/aaca8f91d177061c7b0430cc5cb21a3602897534)]:
  - @lynx-js/webpack-runtime-globals@0.0.6
