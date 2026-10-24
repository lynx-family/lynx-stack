# @lynx-js/react-refresh-webpack-plugin

## 0.4.5

### Patch Changes

- Support `@lynx-js/react@0.129.0`, `@lynx-js/react-webpack-plugin@0.14.0`, and `@lynx-js/react-rsbuild-plugin@0.22.0`. ([#4026](https://github.com/lynx-family/lynx-stack/pull/4026))

## 0.4.4

### Patch Changes

- Deliver the main-thread runtime through named imports from its init entry, including background-only definitions that carry their registration dependencies into the main-thread graph. Runtime code participates in business defines and release processing. Every supported transform supplies semantic runtime requirements, including for definitions injected from background-only modules; watch rebuilds refresh their dependencies and metadata. ([#4066](https://github.com/lynx-family/lynx-stack/pull/4066))

  Upgrade the build plugins and `@lynx-js/react` together. This release requires `@lynx-js/react@^0.128.0`; its runtime and bundled transform use the same module-delivery protocol. The refresh plugin adds support for `@lynx-js/react-webpack-plugin@^0.13.0` while retaining its existing supported versions. Older compiler output is unsupported. The prebuilt worklet-runtime chunk, its package entries, and `loadWorkletRuntime` are removed. Combined lazy chunks share their paired main runtime, and standalone lazy bundles bootstrap themselves.

  The worklet init entry follows `worklet.runtimePkg`: remove a trailing `/internal`, if present, and append `/worklet-runtime/init`. Its `registerWorklet` export uses the existing host registration function when the runtime is already initialized. Default worklet options use `@lynx-js/react/internal` for helpers.

  Testing-library initializes module-delivered worklets on its emulated main thread in Vitest and Rstest.

## 0.4.3

### Patch Changes

- Add `@lynx-js/react-webpack-plugin` `^0.12.0` to the peer dependency range. ([#3979](https://github.com/lynx-family/lynx-stack/pull/3979))

## 0.4.2

### Patch Changes

- Allow `@lynx-js/react-webpack-plugin` v0.11 as a peer dependency. ([#3393](https://github.com/lynx-family/lynx-stack/pull/3393))

## 0.4.1

### Patch Changes

- Extend the `@lynx-js/react-webpack-plugin` peer dependency range to allow `^0.10.0`. ([#2826](https://github.com/lynx-family/lynx-stack/pull/2826))

- Fix `isComponent is not a function` crashing the HMR runtime when ReactLynx is consumed as an async external bundle. ([#2928](https://github.com/lynx-family/lynx-stack/pull/2928))

  The refresh helpers were injected via `ProvidePlugin`, whose dependency edge does not participate in async-module handling, so `@lynx-js/react/refresh` resolved to a pending Promise and `isComponent`/`flush` were `undefined`. They now ship as an ESM module (`runtime/refresh.mjs`) injected by the loader as a real import, awaited through the normal async-module machinery.

- Widen the `@lynx-js/react-webpack-plugin` peer range to `^0.10.0` to accept the ([#2584](https://github.com/lynx-family/lynx-stack/pull/2584))
  minor that ships the FetchBundle loader.

## 0.4.0

### Minor Changes

- **BREAKING CHANGE** ([#2803](https://github.com/lynx-family/lynx-stack/pull/2803))

  Drop webpack support — the plugins now target Rspack only. All public types come from `@rspack/core` instead of `webpack` (e.g. `Compiler`, `Compilation`, `LoaderContext`), and the `webpack` dependency is removed.

- **BREAKING CHANGE** ([#2838](https://github.com/lynx-family/lynx-stack/pull/2838))

  Remove `ReactRefreshWebpackPlugin` / `ReactRefreshWebpackPluginOptions`. Use `ReactRefreshRspackPlugin` instead.

## 0.3.6

### Patch Changes

- Widen `@lynx-js/react-webpack-plugin` peer range to include `^0.9.0`. ([#2626](https://github.com/lynx-family/lynx-stack/pull/2626))

## 0.3.5

### Patch Changes

- Fix snapshot not found error when dev with external bundle ([#2316](https://github.com/lynx-family/lynx-stack/pull/2316))

## 0.3.4

### Patch Changes

- Should apply the plugin when using `mode: 'development'` with `NODE_ENV=production`. ([#1253](https://github.com/lynx-family/lynx-stack/pull/1253))

## 0.3.3

### Patch Changes

- Support `@lynx-js/template-webpack-plugin` v0.7.0. ([#880](https://github.com/lynx-family/lynx-stack/pull/880))

## 0.3.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.3.1

### Patch Changes

- a30c83d: Support `@lynx-js/react-webpack-plugin@0.6.0`
- 5f8d492: Support `@lynx-js/react-webpack-plugin@0.6.0`

## 0.3.0

### Minor Changes

- 587a782: **BRAKING CHANGE**: Require `@lynx-js/react` v0.100.0

### Patch Changes

- 1938bb1: Make peerDependencies of `@lynx-js/react` optional.
