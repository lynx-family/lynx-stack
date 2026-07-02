# @lynx-js/lynx-bundle-rslib-config

## 0.5.1

### Patch Changes

- Updated dependencies [[`7a6577a`](https://github.com/lynx-family/lynx-stack/commit/7a6577a5b29db4020cbba22a911f712bafde7e66)]:
  - @lynx-js/runtime-wrapper-webpack-plugin@0.2.1

## 0.5.0

### Minor Changes

- Add a `web` encode target to `defineExternalBundleRslibConfig` (`encodeOptions.target: 'web'`). ([#2846](https://github.com/lynx-family/lynx-stack/pull/2846))

  When set, the external bundle is emitted as a web binary bundle (`<name>.web.bundle`, encoded via `@lynx-js/web-core/encode`) that the Lynx web platform can decode and load with `lynx.fetchBundle` / `lynx.loadScript`. For the web target, each section is routed to the bundle slot whose chunk format it matches — the main-thread chunk into `lepusCode`, other JS chunks into `manifest`, and CSS into `StyleInfo` — emitting JS as raw source (the web runtime wraps it at load). The default `target: 'tasm'` (the native bundle via `@lynx-js/tasm`) is unchanged.

### Patch Changes

- Updated dependencies [[`46573b5`](https://github.com/lynx-family/lynx-stack/commit/46573b5f7fb59a8f85492cb1f6929887d77a5a42), [`88922df`](https://github.com/lynx-family/lynx-stack/commit/88922df8e09696eb4e24a027e3ed7269f9cc05f1)]:
  - @lynx-js/web-core@0.22.0

## 0.4.0

### Minor Changes

- **BREAKING CHANGE** ([#2803](https://github.com/lynx-family/lynx-stack/pull/2803))

  Drop webpack support — the plugins now target Rspack only. All public types come from `@rspack/core` instead of `webpack` (e.g. `Compiler`, `Compilation`, `LoaderContext`), and the `webpack` dependency is removed.

- Align Rspeedy, the QRCode plugin, and the Lynx bundle Rslib config Node.js engine metadata with Rsbuild v2 and Rslib requirements: Node.js 20.19+ or 22.12+. ([#2789](https://github.com/lynx-family/lynx-stack/pull/2789))

### Patch Changes

- Updated dependencies [[`e0aa6a3`](https://github.com/lynx-family/lynx-stack/commit/e0aa6a3f4fc8ba848a3a41789b3775a46fea24dc)]:
  - @lynx-js/runtime-wrapper-webpack-plugin@0.2.0

## 0.3.3

### Patch Changes

- Update the @lynx-js/tasm dependency to 0.0.39 and align React template attribute descriptors with it. ([#2643](https://github.com/lynx-family/lynx-stack/pull/2643))

## 0.3.2

### Patch Changes

- Support compile main-thread script to bytecode in external bundle ([#2459](https://github.com/lynx-family/lynx-stack/pull/2459))

- Updated dependencies [[`e179680`](https://github.com/lynx-family/lynx-stack/commit/e1796803444ba70efa86609b620c3a753b6694de)]:
  - @lynx-js/css-serializer@0.1.6

## 0.3.1

### Patch Changes

- Updated dependencies [[`156d64d`](https://github.com/lynx-family/lynx-stack/commit/156d64da67e83dfc92e63568cee602c21db873cf), [`59d11b2`](https://github.com/lynx-family/lynx-stack/commit/59d11b2549e5d2ca2ef18c5fe238c468e6db7d9a)]:
  - @lynx-js/css-serializer@0.1.5

## 0.3.0

### Minor Changes

- **BREAKING CHANGE**: ([#2370](https://github.com/lynx-family/lynx-stack/pull/2370))

  Simplify the API for external bundle builds by `externalsPresets` and `externalsPresetDefinitions`.

### Patch Changes

- Preserve the default external-bundle `output.minify.jsOptions` when users set `output.minify: true` in `defineExternalBundleRslibConfig`, so required minifier options are not lost. ([#2390](https://github.com/lynx-family/lynx-stack/pull/2390))

## 0.2.3

### Patch Changes

- Fix snapshot not found error when dev with external bundle ([#2316](https://github.com/lynx-family/lynx-stack/pull/2316))

## 0.2.2

### Patch Changes

- Support bundle and load css in external bundle ([#2143](https://github.com/lynx-family/lynx-stack/pull/2143))

## 0.2.1

### Patch Changes

- Add [`globalObject`](https://webpack.js.org/configuration/output/#outputglobalobject) config for external bundle loading, user can configure it to `globalThis` for BTS external bundle sharing. ([#2123](https://github.com/lynx-family/lynx-stack/pull/2123))

## 0.2.0

### Minor Changes

- Use `LAYERS` exposed by DSL plugins ([#2114](https://github.com/lynx-family/lynx-stack/pull/2114))

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
