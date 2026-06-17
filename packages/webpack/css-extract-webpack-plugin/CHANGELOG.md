# @lynx-js/css-extract-webpack-plugin

## 0.8.0

### Minor Changes

- **BREAKING CHANGE** ([#2803](https://github.com/lynx-family/lynx-stack/pull/2803))

  Remove `CssExtractWebpackPlugin` / `CssExtractWebpackPluginOptions` along with the `mini-css-extract-plugin` dependency. Use `CssExtractRspackPlugin` instead.

  The `cssPlugins` option is now optional, defaulting to `[CSS.Plugins.removeFunctionWhiteSpace()]`.

- **BREAKING CHANGE** ([#2803](https://github.com/lynx-family/lynx-stack/pull/2803))

  Drop webpack support — the plugins now target Rspack only. All public types come from `@rspack/core` instead of `webpack` (e.g. `Compiler`, `Compilation`, `LoaderContext`), and the `webpack` dependency is removed.

### Patch Changes

- Prefix Lynx runtime module names with `webpack/runtime/` (e.g. `Lynx async chunks` → `webpack/runtime/lynx async chunks`), matching the path-structured naming of the bundler's built-in runtime modules. The previous bare names had no path segment, so when they appear as a source-map `sources` entry under a `file://` module-filename template they collapsed into an invalid URL authority (the space-containing name became the host) and broke `SourceMapConsumer` parsing. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

- Widen peer ranges to admit the new minor versions of `@lynx-js/template-webpack-plugin` (^0.12.0) and `@lynx-js/rspeedy` (^0.15.0) shipping with the unified `debug-metadata.json` feature. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

## 0.7.1

### Patch Changes

- Fix CSS source map line offsets when wrapping extracted CSS with cssId metadata. ([#2514](https://github.com/lynx-family/lynx-stack/pull/2514))

- Support `@lynx-js/template-webpack-plugin` v0.11.0. ([#2483](https://github.com/lynx-family/lynx-stack/pull/2483))

## 0.7.0

### Minor Changes

- **BREAKING CHANGE**: Require `@lynx-js/template-webpack-plugin` 0.10.0. ([#1965](https://github.com/lynx-family/lynx-stack/pull/1965))

- Merge all css chunk and generate a `.css.hot-update.json` file for each bundle. ([#1965](https://github.com/lynx-family/lynx-stack/pull/1965))

## 0.6.5

### Patch Changes

- Set main thread JS basename to `lepusCode.filename` in tasm encode data. It will ensure a filename is reported on MTS error without devtools enabled. ([#1949](https://github.com/lynx-family/lynx-stack/pull/1949))

## 0.6.4

### Patch Changes

- Avoid generating `.css.hot-update.json` when HMR is disabled. ([#1811](https://github.com/lynx-family/lynx-stack/pull/1811))

## 0.6.3

### Patch Changes

- Supports `@lynx-js/template-webpack-plugin` 0.9.0. ([#1705](https://github.com/lynx-family/lynx-stack/pull/1705))

## 0.6.2

### Patch Changes

- Fix "emit different content to the same filename" error ([#1482](https://github.com/lynx-family/lynx-stack/pull/1482))

## 0.6.1

### Patch Changes

- Support Rspack v1.4.9. ([#1351](https://github.com/lynx-family/lynx-stack/pull/1351))

## 0.6.0

### Minor Changes

- Fix CSS HMR crash issues by using the same encode options with the main template. ([#1033](https://github.com/lynx-family/lynx-stack/pull/1033))

## 0.5.4

### Patch Changes

- Support `@lynx-js/template-webpack-plugin` v0.7.0. ([#880](https://github.com/lynx-family/lynx-stack/pull/880))

- Support Rspack v1.3.11. ([#866](https://github.com/lynx-family/lynx-stack/pull/866))

## 0.5.3

### Patch Changes

- Fix CSS HMR not working with nested entry name. ([#456](https://github.com/lynx-family/lynx-stack/pull/456))

- fix: add enableCSSInvalidation for encodeCSS of css HMR, this will fix pseudo-class (such as `:active`) not working in HMR. ([#435](https://github.com/lynx-family/lynx-stack/pull/435))

## 0.5.2

### Patch Changes

- feat(css-extra-webpack-plugin): Support css hmr for lazy bundle ([#155](https://github.com/lynx-family/lynx-stack/pull/155))

## 0.5.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.5.0

### Minor Changes

- 1abf8f0: Use compilation hash for `css.hot-update.json` to avoid cache.

### Patch Changes

- 1abf8f0: Set the default `targetSdkVersion` to 3.2.

## 0.4.1

### Patch Changes

- ad49fb1: Support CSS HMR for ReactLynx

## 0.4.0

### Minor Changes

- a217b02: **BREAKING CHANGE**: Change the format of scoped CSS.

  ```diff
  - @file "<file-key>" {
  -   <content>
  - }
  - @cssId <css-id> "<file-key>" {}
  + @cssId "<css-id>" "<file-key>" {
  +   <content>
  + }
  ```

### Patch Changes

- 0d3b44c: Support `@lynx-js/template-webpack-plugin` v0.6.0.

## 0.3.0

### Minor Changes

- 587a782: **BREAKING CHANGE**: Requires `@lynx-js/template-webpack-plugin` v0.5.0

### Patch Changes

- ec189ad: Fix crash when css-loader failed.
- 5099d89: Support `common` in query.

## 0.0.6

### Patch Changes

- 7f8a4fe: Support Rspack v1.1.0.
- Updated dependencies [84e49f5]
- Updated dependencies [f1ddb5a]
- Updated dependencies [d05e60b]
  - @lynx-js/template-webpack-plugin@0.1.0
