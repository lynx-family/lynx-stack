# @lynx-js/webpack-runtime-globals

## 0.0.6

### Patch Changes

- Add `lynxCacheEventsSetupList` and `lynxCacheEvents` to RuntimeGlobals. It will be used to cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready. ([#1370](https://github.com/lynx-family/lynx-stack/pull/1370))

## 0.0.5

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.0.4

### Patch Changes

- 3bf5830: Add `lynxProcessEvalResult`.

## 0.0.3

### Patch Changes

- f5913e5: Add `RuntimeGlobals.lynxChunkEntries`.

  This is used in development for getting correct entry name in `hot-update.js` of lazy bundles.

## 0.0.2

### Patch Changes

- 51d94d0: Add `RuntimeGlobals.lynxAsyncChunkIds`.
