# @lynx-js/web-worker-rpc

## 0.19.8

## 0.19.7

## 0.19.6

### Patch Changes

- fix: when a list-item is deleted from list, the deleted list-item is still showed incorrectly. ([#1092](https://github.com/lynx-family/lynx-stack/pull/1092))

  This is because the `enqueueComponent` method does not delete the node from the Element Tree. It is only to maintain the display node on RL, and lynx web needs to delete the dom additionally.

## 0.19.5

### Patch Changes

- Use the scoped `@lynx-js/source-field` for source build resolution. ([#2096](https://github.com/lynx-family/lynx-stack/pull/2096))

## 0.19.4

### Patch Changes

- Ensure the `default` export entry is last in the package exports map. ([#2075](https://github.com/lynx-family/lynx-stack/pull/2075))

## 0.19.3

### Patch Changes

- feat: support lazy message port assigning in web-worker-rpc ([#2040](https://github.com/lynx-family/lynx-stack/pull/2040))

## 0.19.2

## 0.19.1

## 0.19.0

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.2

## 0.17.1

## 0.17.0

## 0.16.1

## 0.16.0

### Minor Changes

- refactor: provide the mts a real globalThis ([#1589](https://github.com/lynx-family/lynx-stack/pull/1589))

  Before this change, We create a function wrapper and a fake globalThis for Javascript code.

  This caused some issues.

  After this change, we will create an iframe for createing an isolated Javascript context.

  This means the globalThis will be the real one.

## 0.15.7

## 0.15.6

## 0.15.5

## 0.15.4

## 0.15.3

## 0.15.2

## 0.15.1

## 0.15.0

## 0.14.2

## 0.14.1

## 0.14.0

## 0.13.5

## 0.13.4

## 0.13.3

## 0.13.2

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.0

## 0.10.1

## 0.10.0

### Patch Changes

- feat: The onNapiModulesCall function of lynx-view provides the fourth parameter: `lynxView`, which is the actual lynx-view DOM. ([#350](https://github.com/lynx-family/lynx-stack/pull/350))

## 0.9.1

## 0.9.0

### Patch Changes

- feat: add a new type function RpcCallType ([#283](https://github.com/lynx-family/lynx-stack/pull/283))

## 0.8.0

### Patch Changes

- feat: `createRpcEndpoint` adds a new parameter: `hasReturnTransfer`. ([#194](https://github.com/lynx-family/lynx-stack/pull/194))

  When `isSync`: false, `hasReturn`: true, you can add `transfer` to the callback postMessage created.

  At this time, the return value structure of register-handler is changed: `{ data: unknown; transfer: Transferable[]; } | Promise<{ data: unknown; transfer: Transferable[];}>`.

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
