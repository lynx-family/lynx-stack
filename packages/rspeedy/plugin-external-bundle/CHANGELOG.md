# @lynx-js/external-bundle-rsbuild-plugin

## 0.1.1

### Patch Changes

- Updated dependencies [[`3262ca8`](https://github.com/lynx-family/lynx-stack/commit/3262ca88e93f66a1b745d4cc12b98959d20e9413)]:
  - @lynx-js/externals-loading-webpack-plugin@0.1.1

## 0.1.0

### Minor Changes

- **BREAKING CHANGE**: ([#2370](https://github.com/lynx-family/lynx-stack/pull/2370))

  Simplify the API for external bundle builds by `externalsPresets` and `externalsPresetDefinitions`.

### Patch Changes

- Updated dependencies [[`7b7a0c6`](https://github.com/lynx-family/lynx-stack/commit/7b7a0c6ee35e32f9575436cb36b25f2931f43c05)]:
  - @lynx-js/externals-loading-webpack-plugin@0.1.0

## 0.0.4

### Patch Changes

- Updated dependencies [[`ed566f0`](https://github.com/lynx-family/lynx-stack/commit/ed566f0fe6a14ffae59d21bd2c5e5dd2755f28a4)]:
  - @lynx-js/externals-loading-webpack-plugin@0.0.5

## 0.0.3

### Patch Changes

- Updated dependencies [[`c28b051`](https://github.com/lynx-family/lynx-stack/commit/c28b051836ca4613470f6ed5ceaf56c3ab617ed3), [`4cbf809`](https://github.com/lynx-family/lynx-stack/commit/4cbf8096c5aeeb1636c2dd1bb8074bdaba73dfb1)]:
  - @lynx-js/externals-loading-webpack-plugin@0.0.4

## 0.0.2

### Patch Changes

- Add [`globalObject`](https://webpack.js.org/configuration/output/#outputglobalobject) config for external bundle loading, user can configure it to `globalThis` for BTS external bundle sharing. ([#2123](https://github.com/lynx-family/lynx-stack/pull/2123))

- Updated dependencies [[`959360c`](https://github.com/lynx-family/lynx-stack/commit/959360c82431669eb3adb5acc7a86177ce1d082c)]:
  - @lynx-js/externals-loading-webpack-plugin@0.0.3

## 0.0.1

### Patch Changes

- Introduce `@lynx-js/external-bundle-rsbuild-plugin`. ([#2006](https://github.com/lynx-family/lynx-stack/pull/2006))

  ```ts
  // lynx.config.ts
  import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

  export default {
    plugins: [
      pluginReactLynx(),
      pluginExternalBundle({
        externals: {
          lodash: {
            url: 'http://lodash.lynx.bundle',
            background: { sectionPath: 'background' },
            mainThread: { sectionPath: 'mainThread' },
          },
        },
      }),
    ],
  }
  ```

- Updated dependencies [[`491c5ef`](https://github.com/lynx-family/lynx-stack/commit/491c5efac23e3c99914fb9270d0476aa5c0207f9)]:
  - @lynx-js/externals-loading-webpack-plugin@0.0.2
