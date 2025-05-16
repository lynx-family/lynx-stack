# @lynx-js/runtime-wrapper-webpack-plugin

## 0.1.0

### Minor Changes

- Add parameter forwarding for Browser Object Model (BOM) APIs. ([#787](https://github.com/lynx-family/lynx-stack/pull/787))

  This allows direct access to APIs like `fetch`, `requestAnimationFrame`.

## 0.0.10

### Patch Changes

- feat: add `experimental_isLazyBundle` option, it will disable lynxChunkEntries for standalone lazy bundle ([#653](https://github.com/lynx-family/lynx-stack/pull/653))

## 0.0.9

### Patch Changes

- Add `window` variable to callback argument in `background.js` and the `window` is `undefined` in Lynx. Sometimes it's useful to distinguish between Lynx and the Web. ([#248](https://github.com/lynx-family/lynx-stack/pull/248))

  ```js
  define('background.js', (..., window) => {
    console.log(window); // `undefined` in Lynx
  })
  ```

## 0.0.8

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/webpack-runtime-globals@0.0.5

## 0.0.7

### Patch Changes

- 1abf8f0: Set the default `targetSdkVersion` to 3.2.

## 0.0.6

### Patch Changes

- 26258c7: Shim `fetch` using `lynx.fetch`.

## 0.0.5

### Patch Changes

- Updated dependencies [3bf5830]
  - @lynx-js/webpack-runtime-globals@0.0.4

## 0.0.4

### Patch Changes

- 649b978: Add `globDynamicComponentEntry` for background script.

  |             |     Before      |     After      |
  | :---------: | :-------------: | :------------: |
  | Main Bundle | defined(global) | Defined(local) |
  | Lazy Bundle | defined(global) | Defined(local) |

- f5913e5: Inject `RuntimeGlobals.lynxChunkEntries` to ensure getting correct entryName in lazy bundles.
- Updated dependencies [f5913e5]
  - @lynx-js/webpack-runtime-globals@0.0.3

## 0.0.3

### Patch Changes

- be5d731: Override `Promise` using `lynx.Promise`.
- 3fae00a: Add `injectVars` option.
