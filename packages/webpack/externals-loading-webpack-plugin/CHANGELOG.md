# @lynx-js/externals-loading-webpack-plugin

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
