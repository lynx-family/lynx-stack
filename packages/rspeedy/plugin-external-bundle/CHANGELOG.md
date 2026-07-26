# @lynx-js/external-bundle-rsbuild-plugin

## 0.4.1

### Patch Changes

- Ship the refresh runtime in the shared external bundle so it is loaded once instead of per card. ([#3009](https://github.com/lynx-family/lynx-stack/pull/3009))

  `@lynx-js/react/refresh` was missing from both the `react-umd` entry and the `reactlynx` externals preset, so every card bundled its own copy. Each copy overwrites `options.debounceRendering` on the _shared_ ReactLynx runtime with a closure that defers through that card's own `Promise`. The last card loaded wins, and once it is destroyed its microtask queue stops draining — the lost flush leaves Preact's scheduling counter set, so no card in the shared context ever re-renders again.

  Only the development bundle carries it; the production bundle is unchanged in size.

## 0.4.0

### Minor Changes

- The `reactlynx` externals preset accepts `{ async: true }`, mounting ReactLynx as an awaited promise so async runtimes can load it via `fetchBundle().then` (the sync array form reads `React.memo` etc. off a pending promise and gets `undefined`). Externals presets resolve per environment (`environmentName` is available in the preset context): `lynx` / `lynx-*` environments use `react.lynx.bundle`, other environments (e.g. `web`) use the web-encoded `@lynx-js/react-umd/{dev,prod}-web` `react.web.bundle` — `async` only controls the mount form. ([#2934](https://github.com/lynx-family/lynx-stack/pull/2934))

### Patch Changes

- Updated dependencies [[`34318ea`](https://github.com/lynx-family/lynx-stack/commit/34318ea3432b6484a383707458ed9c4ee19e2097)]:
  - @lynx-js/externals-loading-webpack-plugin@0.2.1

## 0.3.0

### Minor Changes

- Support Rsbuild v2 in the external bundle plugin by replacing the removed `dev.setupMiddlewares` integration with [`server.setup`](https://rsbuild.rs/guide/upgrade/v1-to-v2#others) and registering local external bundle asset middleware only during dev server startup. ([#2603](https://github.com/lynx-family/lynx-stack/pull/2603))

## 0.2.0

### Minor Changes

- feat: support retrying `fetchBundle` on timeout via a new `retries` option (defaults to `0`). ([#2681](https://github.com/lynx-family/lynx-stack/pull/2681))

### Patch Changes

- Updated dependencies [[`069af04`](https://github.com/lynx-family/lynx-stack/commit/069af04f7afd5fc9944f46f1f1488aed03f03b57)]:
  - @lynx-js/externals-loading-webpack-plugin@0.2.0

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
