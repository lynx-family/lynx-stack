# @lynx-js/react-refresh-webpack-plugin

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
