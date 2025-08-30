# @lynx-js/cache-events-webpack-plugin

## 0.0.2

### Patch Changes

- Fix that `__webpack_require__.lynx_ce` is incorrectly injected when lazy bundle is enabled. ([#1616](https://github.com/lynx-family/lynx-stack/pull/1616))

## 0.0.1

### Patch Changes

- Add new `LynxCacheEventsPlugin`, which will cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready. ([#1370](https://github.com/lynx-family/lynx-stack/pull/1370))

- Updated dependencies [[`aaca8f9`](https://github.com/lynx-family/lynx-stack/commit/aaca8f91d177061c7b0430cc5cb21a3602897534)]:
  - @lynx-js/webpack-runtime-globals@0.0.6
