# @lynx-js/web-core-server

## 0.17.2

## 0.17.1

## 0.17.0

## 0.16.1

### Patch Changes

- refactor: improve chunk loading ([#1703](https://github.com/lynx-family/lynx-stack/pull/1703))

- feat: supports lazy bundle. (This feature requires `@lynx-js/lynx-core >= 0.1.3`) ([#1235](https://github.com/lynx-family/lynx-stack/pull/1235))

## 0.16.0

### Minor Changes

- refactor: provide the mts a real globalThis ([#1589](https://github.com/lynx-family/lynx-stack/pull/1589))

  Before this change, We create a function wrapper and a fake globalThis for Javascript code.

  This caused some issues.

  After this change, we will create an iframe for createing an isolated Javascript context.

  This means the globalThis will be the real one.

## 0.15.7

## 0.15.6

### Patch Changes

- refactor: use utf-8 string ([#1473](https://github.com/lynx-family/lynx-stack/pull/1473))

## 0.15.5

### Patch Changes

- fix: load main-thread chunk in ESM format ([#1437](https://github.com/lynx-family/lynx-stack/pull/1437))

  See [nodejs/node#59362](https://github.com/nodejs/node/issues/59362) for more details.

## 0.15.4

### Patch Changes

- refactor: bundle web-core-server ([#819](https://github.com/lynx-family/lynx-stack/pull/819))

## 0.15.3

## 0.15.2

### Patch Changes

- feat: support SSR for all-on-ui ([#1029](https://github.com/lynx-family/lynx-stack/pull/1029))

- feat: move SSR hydrate essential info to the ssr attribute ([#1292](https://github.com/lynx-family/lynx-stack/pull/1292))

  We found that in browser there is no simple tool to decode a base64 string

  Therefore we move the data to `ssr` attribute

  Also fix some ssr issues

- feat: dump the event info on ssr stage ([#1237](https://github.com/lynx-family/lynx-stack/pull/1237))

- feat: mark template elements for SSR and update part ID handling ([#1286](https://github.com/lynx-family/lynx-stack/pull/1286))

## 0.15.1

## 0.15.0

### Patch Changes

- feat: support to dump the css og system's style ([#1272](https://github.com/lynx-family/lynx-stack/pull/1272))

- perf: use rust implemented style transformer ([#1094](https://github.com/lynx-family/lynx-stack/pull/1094))

## 0.14.2

### Patch Changes

- chore: extract shared logic from web-core and web-core-server's loadTemplate into a unified generateTemplate function ([#1211](https://github.com/lynx-family/lynx-stack/pull/1211))

## 0.14.1

## 0.14.0

### Patch Changes

- feat: add `_SetSourceMapRelease(errInfo)` MTS API. ([#1118](https://github.com/lynx-family/lynx-stack/pull/1118))

  You can get `errInfo.release` through `e.detail.release` in the error event callback of lynx-view.

  The `_SetSourceMapRelease` function is not complete yet, because it is currently limited by the Web platform and some functions and some props such as `err.stack` do not need to be supported for the time being.

- feat: add `_I18nResourceTranslation` api in mts && `init-i18n-resources` attr, `i18nResourceMissed` event of lynx-view. ([#1065](https://github.com/lynx-family/lynx-stack/pull/1065))

  `init-i18n-resource` is the complete set of i18nResources that need to be maintained on the container side. Note: You need to pass this value when lynx-view is initialized.

  You can use `_I18nResourceTranslation` in MTS to get the corresponding i18nResource from `init-i18n-resources`. If it is undefined, the `i18nResourceMissed` event will be dispatched.

  ```js
  // ui thread
  lynxView.initI18nResources = [
    {
      options: {
        locale: 'en',
        channel: '1',
        fallback_url: '',
      },
      resource: {
        hello: 'hello',
        lynx: 'lynx web platform1',
      },
    },
  ];
  lynxView.addEventListener('i18nResourceMissed', (e) => {
    console.log(e);
  });

  // mts
  _I18nResourceTranslation({
    locale: 'en',
    channel: '1',
    fallback_url: '',
  });
  ```

## 0.13.5

### Patch Changes

- refactor: move some internal status to dom's attribute ([#945](https://github.com/lynx-family/lynx-stack/pull/945))

  It's essential for SSR

- refactor: move component config info to attribute ([#984](https://github.com/lynx-family/lynx-stack/pull/984))

- refactor: save dataset on an attribute ([#981](https://github.com/lynx-family/lynx-stack/pull/981))

  On lynx, the `data-*` attributes have different behaviors than the HTMLElement has.

  The dataset will be treated as properties, the key will not be applied the camel-case <-> hyphenate name transformation.

  Before this commit we use it as a runtime data, but after this commit we will use encodeURI(JSON.stringify(dataset)) to encode it as a string.

- fix: dump encode data in comment ([#989](https://github.com/lynx-family/lynx-stack/pull/989))

## 0.13.4

### Patch Changes

- feat: support to dump ssrID ([#919](https://github.com/lynx-family/lynx-stack/pull/919))

## 0.13.3

### Patch Changes

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- feat: support to dump ssrEncode string ([#876](https://github.com/lynx-family/lynx-stack/pull/876))

- perf: improve dom operation performance ([#881](https://github.com/lynx-family/lynx-stack/pull/881))

  - code clean for offscreen-document, cut down inheritance levels
  - add `appendChild` method for OffscreenElement, improve performance for append one node
  - bypass some JS getter for dumping SSR string

- feat: dump dehydrate string with shadow root template ([#838](https://github.com/lynx-family/lynx-stack/pull/838))

## 0.13.2

### Patch Changes

- perf: use v8 hint for generated javascript file ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  https://v8.dev/blog/explicit-compile-hints

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- feat: improve template js loading ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  now we will create temp js file based on the new `templateName` argument.
