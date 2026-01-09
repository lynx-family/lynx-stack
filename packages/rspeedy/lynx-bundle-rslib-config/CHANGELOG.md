# @lynx-js/lynx-bundle-rslib-config

## 0.1.0

### Minor Changes

- Update external bundle minimum SDK version to 3.5. ([#2037](https://github.com/lynx-family/lynx-stack/pull/2037))

### Patch Changes

- Fix `globDynamicComponentEntry is not defined` error when minify is enabled in external bundle consumer. ([#2058](https://github.com/lynx-family/lynx-stack/pull/2058))

## 0.0.2

### Patch Changes

- Introduce `@lynx-js/externals-loading-webpack-plugin`. It will help you to load externals built by `@lynx-js/lynx-bundle-rslib-config`. ([#1924](https://github.com/lynx-family/lynx-stack/pull/1924))

  ```js
  // webpack.config.js
  import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin'

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
  }
  ```

## 0.0.1

### Patch Changes

- Add `@lynx-js/lynx-bundle-rslib-config` for bundling Lynx bundle with [Rslib](https://rslib.rs/): ([#1943](https://github.com/lynx-family/lynx-stack/pull/1943))

  ```js
  // rslib.config.js
  import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'

  export default defineExternalBundleRslibConfig({
    id: 'utils-lib',
    source: {
      entry: {
        utils: './src/utils.ts',
      },
    },
  })
  ```
