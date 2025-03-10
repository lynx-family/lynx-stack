# @lynx-js/css-extract-webpack-plugin

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
