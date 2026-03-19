# @lynx-js/externals-loading-webpack-plugin

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
