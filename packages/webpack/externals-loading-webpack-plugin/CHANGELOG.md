# @lynx-js/externals-loading-webpack-plugin

## 0.5.1

### Patch Changes

- Increase the default synchronous external bundle loading timeout from 2 seconds to 5 seconds to match ReactLynx lazy bundle loading. Explicit `timeout` options continue to override the default. ([#4440](https://github.com/lynx-family/lynx-stack/pull/4440))

## 0.5.0

### Minor Changes

- Support content-hashed background section names via `encodeOptions.hashSectionNames` and `__sectionMap` resolution in external bundle loading to avoid stale `LynxGroup`-scoped `loadScript` cache hits after in-place bundle updates. ([#4409](https://github.com/lynx-family/lynx-stack/pull/4409))

## 0.4.0

### Minor Changes

- Fetch external bundles on first import instead of prefetching unused bundles during startup. Preserve synchronous exports and asynchronous Promise semantics, including runtime-selected loading modes. ([#4363](https://github.com/lynx-family/lynx-stack/pull/4363))

  Propagate fetch failures to the importing module instead of leaving its loading Promise pending.
- Support standalone runtime URL resolvers evaluated on first import. String results preserve native synchronous loading, while Promise results support asynchronous URL delivery. Keep fixed URLs and bundlePath loading unchanged. ([#4370](https://github.com/lynx-family/lynx-stack/pull/4370))

## 0.3.0

### Minor Changes

- Support runtime `async` callbacks for external bundles, allowing applications to select asynchronous fetching on Harmony and synchronous fetching on other platforms in the same bundle. Callback externals use promise module semantics in both modes. ([#4277](https://github.com/lynx-family/lynx-stack/pull/4277))

### Patch Changes

- Evaluate synchronous and asynchronous external sections when their modules are imported instead of during runtime startup. This lets a page initialize its worklet runtime before importing legacy component externals, while preserving bundle prefetching and caching exports or the loading Promise on first access. ([#4262](https://github.com/lynx-family/lynx-stack/pull/4262))

## 0.2.1

### Patch Changes

- Fix `async: true` externals with a subpath `libraryName` (e.g. `['ReactLynx', 'React']`) resolving to `undefined`. The generated `promise` external now picks all subpath segments after the mounted namespace promise resolves, instead of reading them synchronously off the pending promise. ([#2928](https://github.com/lynx-family/lynx-stack/pull/2928))

## 0.2.0

### Minor Changes

- feat: support retrying `fetchBundle` on timeout via a new `retries` option (defaults to `0`). ([#2681](https://github.com/lynx-family/lynx-stack/pull/2681))

## 0.1.1

### Patch Changes

- fix: deduplicate `loadScript` calls for externals sharing the same (bundle, section) pair ([#2465](https://github.com/lynx-family/lynx-stack/pull/2465))

  When multiple externals had different `libraryName` values but pointed to the same
  bundle URL and section path, `createLoadExternalSync`/`createLoadExternalAsync` was
  called once per external, causing `lynx.loadScript` to execute redundantly for the
  same section. Now only the first external in each `(url, sectionPath)` group triggers
  the load; subsequent externals in the group are assigned the already-loaded result
  directly.

## 0.1.0

### Minor Changes

- **BREAKING CHANGE**: ([#2370](https://github.com/lynx-family/lynx-stack/pull/2370))

  Simplify the API for external bundle builds by `externalsPresets` and `externalsPresetDefinitions`.

## 0.0.5

### Patch Changes

- Fix snapshot not found error when dev with external bundle ([#2316](https://github.com/lynx-family/lynx-stack/pull/2316))

## 0.0.4

### Patch Changes

- perf: optimize external bundle loading by merging multiple `fetchBundle` calls for the same URL into a single request. ([#2307](https://github.com/lynx-family/lynx-stack/pull/2307))

- Support bundle and load css in external bundle ([#2143](https://github.com/lynx-family/lynx-stack/pull/2143))

## 0.0.3

### Patch Changes

- Add [`globalObject`](https://webpack.js.org/configuration/output/#outputglobalobject) config for external bundle loading, user can configure it to `globalThis` for BTS external bundle sharing. ([#2123](https://github.com/lynx-family/lynx-stack/pull/2123))

## 0.0.2

### Patch Changes

- Export `ExternalValue` ts type. ([#2037](https://github.com/lynx-family/lynx-stack/pull/2037))

## 0.0.1

### Patch Changes

- Introduce `@lynx-js/externals-loading-webpack-plugin`. It will help you to load externals built by `@lynx-js/lynx-bundle-rslib-config`. ([#1924](https://github.com/lynx-family/lynx-stack/pull/1924))

  ```js
  // webpack.config.js
  import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';

  export default {
    plugins: [
      new ExternalsLoadingPlugin({
        mainThreadLayer: 'main-thread',
        backgroundLayer: 'background',
        externals: {
          lodash: {
            url: 'http://lodash.lynx.bundle',
            background: { sectionPath: 'background' },
            mainThread: { sectionPath: 'main-thread' },
          },
        },
      }),
    ],
  };
  ```
