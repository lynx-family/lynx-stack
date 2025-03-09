# @lynx-js/web-worker-rpc

## 0.7.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.7.0

## 0.6.2

## 0.6.1

## 0.6.0

## 0.5.1

## 0.5.0

### Patch Changes

- 04607bd: refractor: do not create return endpoint for those rpcs don't need it
- e0f0793: fix: make `createCallbackify` to declare the callback position

## 0.4.2

### Patch Changes

- 8d583f5: refactor: organize internal dependencies
- 38f21e4: fix: avoid card freezing on the background.js starts too fast

  if the background thread starts too fast, Reactlynx runtime will assign an lazy handler first and then replace it by the real handler.

  Before this commit we cannot handle such "replace" operation for cross-threading call.

  Now we fix this issue
