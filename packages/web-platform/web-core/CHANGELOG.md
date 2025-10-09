# @lynx-js/web-core

## 0.17.2

### Patch Changes

- feat: support load bts chunk from remote address ([#1834](https://github.com/lynx-family/lynx-stack/pull/1834))

  - re-support chunk splitting
  - support lynx.requireModule with a json file
  - support lynx.requireModule, lynx.requireModuleAsync with a remote url
  - support to add a breakpoint in chrome after reloading the web page

- Updated dependencies [[`a35a245`](https://github.com/lynx-family/lynx-stack/commit/a35a2452e5355bda3c475f9a750a86085e0cf56a)]:
  - @lynx-js/web-worker-runtime@0.17.2
  - @lynx-js/web-constants@0.17.2
  - @lynx-js/web-mainthread-apis@0.17.2
  - @lynx-js/web-worker-rpc@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.17.1
  - @lynx-js/web-mainthread-apis@0.17.1
  - @lynx-js/web-worker-rpc@0.17.1
  - @lynx-js/web-worker-runtime@0.17.1

## 0.17.0

### Minor Changes

- break(web): temporary remove support for chunk split ([#1739](https://github.com/lynx-family/lynx-stack/pull/1739))

  Since the global variables cannot be accessed in the splited chunk, we temporary remove supporting for chunk spliting

  Developers could easily remove the chunk Split settings in Rspeedy for migration

  ```
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    performance: {
      chunkSplit: {
        strategy: 'all-in-one',
      },
    },
  })
  ```

### Patch Changes

- fix: lazy component load error ([#1794](https://github.com/lynx-family/lynx-stack/pull/1794))

  Some special version template may have chunk loading error. We fixed it.

- fix: avoid duplicate style transformation ([#1748](https://github.com/lynx-family/lynx-stack/pull/1748))

  After this commit, we use DAG methods to handle the styleInfos

- fix: add sandbox attribute to iframe for enhanced security ([#1709](https://github.com/lynx-family/lynx-stack/pull/1709))

- fix: the default template loader won't fetch twice for one url ([#1709](https://github.com/lynx-family/lynx-stack/pull/1709))

- Updated dependencies [[`721635d`](https://github.com/lynx-family/lynx-stack/commit/721635de6c1d2d617c7cbaa86e7d816c42d62930), [`93d707b`](https://github.com/lynx-family/lynx-stack/commit/93d707b82a59f7256952e21da6dcad2999f8233d), [`d150ed4`](https://github.com/lynx-family/lynx-stack/commit/d150ed440a4f1e9d9a3a2911adf6e6fa39a0c589)]:
  - @lynx-js/web-mainthread-apis@0.17.0
  - @lynx-js/web-constants@0.17.0
  - @lynx-js/web-worker-runtime@0.17.0
  - @lynx-js/web-worker-rpc@0.17.0

## 0.16.1

### Patch Changes

- refactor: improve chunk loading ([#1703](https://github.com/lynx-family/lynx-stack/pull/1703))

- feat: supports lazy bundle. (This feature requires `@lynx-js/lynx-core >= 0.1.3`) ([#1235](https://github.com/lynx-family/lynx-stack/pull/1235))

- Updated dependencies [[`608f375`](https://github.com/lynx-family/lynx-stack/commit/608f375e20732cc4c9f141bfbf9800ba6896100b)]:
  - @lynx-js/web-mainthread-apis@0.16.1
  - @lynx-js/web-worker-runtime@0.16.1
  - @lynx-js/web-constants@0.16.1
  - @lynx-js/web-worker-rpc@0.16.1

## 0.16.0

### Minor Changes

- refactor: provide the mts a real globalThis ([#1589](https://github.com/lynx-family/lynx-stack/pull/1589))

  Before this change, We create a function wrapper and a fake globalThis for Javascript code.

  This caused some issues.

  After this change, we will create an iframe for createing an isolated Javascript context.

  This means the globalThis will be the real one.

### Patch Changes

- refactor: add `:not([l-e-name])` at the end of selector for lazy component ([#1622](https://github.com/lynx-family/lynx-stack/pull/1622))

- feat: remove multi-thread mts heating ([#1597](https://github.com/lynx-family/lynx-stack/pull/1597))

  The default rendering mode is "all-on-ui". Therefore the preheating for "multi-thread" will be removed.

- fix: the SystemInfo in bts should be assigned to the globalThis ([#1599](https://github.com/lynx-family/lynx-stack/pull/1599))

- Updated dependencies [[`1a32dd8`](https://github.com/lynx-family/lynx-stack/commit/1a32dd886fe736c95639f67028cf7685377d9769), [`bb53d9a`](https://github.com/lynx-family/lynx-stack/commit/bb53d9a035f607e7c89952098d4ed77877a2e3c1), [`1a32dd8`](https://github.com/lynx-family/lynx-stack/commit/1a32dd886fe736c95639f67028cf7685377d9769), [`c1f8715`](https://github.com/lynx-family/lynx-stack/commit/c1f8715a81b2e69ff46fc363013626db4468c209)]:
  - @lynx-js/web-mainthread-apis@0.16.0
  - @lynx-js/web-constants@0.16.0
  - @lynx-js/web-worker-runtime@0.16.0
  - @lynx-js/offscreen-document@0.1.4
  - @lynx-js/web-worker-rpc@0.16.0

## 0.15.7

### Patch Changes

- fix: fake uidisappear event ([#1539](https://github.com/lynx-family/lynx-stack/pull/1539))

- Updated dependencies [[`70863fb`](https://github.com/lynx-family/lynx-stack/commit/70863fbc311d8885ebda40855668097b0631f521)]:
  - @lynx-js/web-mainthread-apis@0.15.7
  - @lynx-js/web-constants@0.15.7
  - @lynx-js/web-worker-runtime@0.15.7
  - @lynx-js/web-worker-rpc@0.15.7

## 0.15.6

### Patch Changes

- fix: systeminfo in mts function ([#1537](https://github.com/lynx-family/lynx-stack/pull/1537))

- refactor: use utf-8 string ([#1473](https://github.com/lynx-family/lynx-stack/pull/1473))

- Fix mtsGlobalThis race condition in createRenderAllOnUI ([#1506](https://github.com/lynx-family/lynx-stack/pull/1506))

- Updated dependencies [[`405a917`](https://github.com/lynx-family/lynx-stack/commit/405a9170442ae32603b7687549b49ab4b34aff92), [`b8f89e2`](https://github.com/lynx-family/lynx-stack/commit/b8f89e25f106a15ba9d70f2df06dfb684cbb6633), [`f76aae9`](https://github.com/lynx-family/lynx-stack/commit/f76aae9ea06abdc7022ba508d22f9f4eb00864e8), [`b8b060b`](https://github.com/lynx-family/lynx-stack/commit/b8b060b9bef722bb47bd90c33fab3922160c711d), [`d8381a5`](https://github.com/lynx-family/lynx-stack/commit/d8381a58d12af6424cab4955617251e798bdc9f1), [`214898b`](https://github.com/lynx-family/lynx-stack/commit/214898bb9c74fc9b44e68cb220a4c02485102ce2), [`ab8cee4`](https://github.com/lynx-family/lynx-stack/commit/ab8cee4bab384fa905c045c4b4b93e5d4a95d57f)]:
  - @lynx-js/web-mainthread-apis@0.15.6
  - @lynx-js/web-constants@0.15.6
  - @lynx-js/web-worker-runtime@0.15.6
  - @lynx-js/web-worker-rpc@0.15.6

## 0.15.5

### Patch Changes

- fix: load main-thread chunk in ESM format ([#1437](https://github.com/lynx-family/lynx-stack/pull/1437))

  See [nodejs/node#59362](https://github.com/nodejs/node/issues/59362) for more details.

- feat: support path() for `createQuerySelector` ([#1456](https://github.com/lynx-family/lynx-stack/pull/1456))

  - Added `getPathInfo` API to `NativeApp` and its cross-thread handler for retrieving the path from a DOM node to the root.
  - Implemented endpoint and handler registration in both background and UI threads.
  - Implemented `nativeApp.getPathInfo()`

- fix: when `onNativeModulesCall` is delayed in mounting, the NativeModules execution result may be undefined. ([#1457](https://github.com/lynx-family/lynx-stack/pull/1457))

- fix: `onNativeModulesCall` && `onNapiModulesCall` use getter to get. ([#1466](https://github.com/lynx-family/lynx-stack/pull/1466))

- Updated dependencies [[`29434ae`](https://github.com/lynx-family/lynx-stack/commit/29434aec853f14242f521316429cf07a93b8c371), [`fb7096b`](https://github.com/lynx-family/lynx-stack/commit/fb7096bb3c79166cd619a407095b8206eccb7918)]:
  - @lynx-js/web-mainthread-apis@0.15.5
  - @lynx-js/web-constants@0.15.5
  - @lynx-js/web-worker-runtime@0.15.5
  - @lynx-js/web-worker-rpc@0.15.5

## 0.15.4

### Patch Changes

- feat: support `__ElementFromBinary` ([#1391](https://github.com/lynx-family/lynx-stack/pull/1391))

- fix: crash on chrome<96 ([#1361](https://github.com/lynx-family/lynx-stack/pull/1361))

  https://github.com/wasm-bindgen/wasm-bindgen/issues/4211#issuecomment-2505965903

  https://github.com/WebAssembly/binaryen/issues/7358

  The rust toolchain enables WASM feature `reference types` by default.

  However this feature is not supported by chromium lower than version 96

  Therefore we found a workaround for it.

  In this implementation we detect if browser supports `reference types` first.

  If user's browser supported it, we load the wasm file with `reference types` on, otherwise we load the wasm file with `reference types` off.

- Updated dependencies [[`22ca433`](https://github.com/lynx-family/lynx-stack/commit/22ca433eb96b39724c6eb47ce0a938d291bbdef2), [`8645d12`](https://github.com/lynx-family/lynx-stack/commit/8645d1240ecb2005da52ab2ffeb10a5d08cc9cc2), [`143e481`](https://github.com/lynx-family/lynx-stack/commit/143e481b4353b3c3d2e8d9cc4f201442ca56f097)]:
  - @lynx-js/web-mainthread-apis@0.15.4
  - @lynx-js/web-constants@0.15.4
  - @lynx-js/web-worker-runtime@0.15.4
  - @lynx-js/web-worker-rpc@0.15.4

## 0.15.3

### Patch Changes

- fix: improve compatibility with legacy template ([#1337](https://github.com/lynx-family/lynx-stack/pull/1337))

  avoid "object Object" error for old version rspeedy outputs

- Updated dependencies [[`0da5ef0`](https://github.com/lynx-family/lynx-stack/commit/0da5ef03e41f20e9f8019c6dc03cb4a38ab18854)]:
  - @lynx-js/web-constants@0.15.3
  - @lynx-js/web-mainthread-apis@0.15.3
  - @lynx-js/web-worker-runtime@0.15.3
  - @lynx-js/web-worker-rpc@0.15.3

## 0.15.2

### Patch Changes

- feat: support SSR for all-on-ui ([#1029](https://github.com/lynx-family/lynx-stack/pull/1029))

- feat: move SSR hydrate essential info to the ssr attribute ([#1292](https://github.com/lynx-family/lynx-stack/pull/1292))

  We found that in browser there is no simple tool to decode a base64 string

  Therefore we move the data to `ssr` attribute

  Also fix some ssr issues

- feat: support \_\_MarkTemplateElement, \_\_MarkPartElement and \_\_GetTemplateParts for all-on-ui ([#1275](https://github.com/lynx-family/lynx-stack/pull/1275))

- feat: mark template elements for SSR and update part ID handling ([#1286](https://github.com/lynx-family/lynx-stack/pull/1286))

- Updated dependencies [[`cebda59`](https://github.com/lynx-family/lynx-stack/commit/cebda592ac5c7d152c877c2ac5ec403d477077e1), [`1443e46`](https://github.com/lynx-family/lynx-stack/commit/1443e468a353363e29aab0d90cd8b91c232a5525), [`5062128`](https://github.com/lynx-family/lynx-stack/commit/5062128c68e21abcf276ebcb40d7cc8f6e54244b), [`f656b7f`](https://github.com/lynx-family/lynx-stack/commit/f656b7f0d390d69c0da0d11a6c9b3f66ae877ac8)]:
  - @lynx-js/web-mainthread-apis@0.15.2
  - @lynx-js/web-constants@0.15.2
  - @lynx-js/web-worker-runtime@0.15.2
  - @lynx-js/web-worker-rpc@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-mainthread-apis@0.15.1
  - @lynx-js/web-worker-runtime@0.15.1
  - @lynx-js/web-constants@0.15.1
  - @lynx-js/web-worker-rpc@0.15.1

## 0.15.0

### Minor Changes

- refactor: move exposure system to web-core ([#1254](https://github.com/lynx-family/lynx-stack/pull/1254))

  **THIS IS A BREAKING CHANGE**

  **You'll need to upgrade your @lynx-js/web-elements to >= 0.8.0**

  For SSR and better performance, we moved the lynx's exposure system from web-element to web-core.

  Before this commit, we create Intersection observers by creating HTMLElements.

  After this commit, we will create such Intersection observers after dom stabled.

  Also, the setInterval for exposure has been removed, now we use an on time lazy timer for such features.

### Patch Changes

- refactor: improve `linear-weight-sum` performance ([#1216](https://github.com/lynx-family/lynx-stack/pull/1216))

- feat: lynx-view error event adds a new parameter: `e.detail.fileName`, which will be determined by the file location where the error occurred, either `lepus.js` or `app-service.js`. ([#1242](https://github.com/lynx-family/lynx-stack/pull/1242))

- perf: use rust implemented style transformer ([#1094](https://github.com/lynx-family/lynx-stack/pull/1094))

- Updated dependencies [[`7b75469`](https://github.com/lynx-family/lynx-stack/commit/7b75469d05dd2ec78bf6e1e54b94c8dff938eb40), [`f54a7aa`](https://github.com/lynx-family/lynx-stack/commit/f54a7aa539ad56ccd1e7e1b49d7ee59e742fe493), [`224c653`](https://github.com/lynx-family/lynx-stack/commit/224c653f370d807281fa0a9ffbb4f4dd5c9d308e)]:
  - @lynx-js/offscreen-document@0.1.3
  - @lynx-js/web-worker-runtime@0.15.0
  - @lynx-js/web-mainthread-apis@0.15.0
  - @lynx-js/web-constants@0.15.0
  - @lynx-js/web-worker-rpc@0.15.0

## 0.14.2

### Patch Changes

- feat: merge multiple markTiming RPC communication events together and send them together, which can effectively reduce the number of RPC communications. ([#1178](https://github.com/lynx-family/lynx-stack/pull/1178))

- chore: extract shared logic from web-core and web-core-server's loadTemplate into a unified generateTemplate function ([#1211](https://github.com/lynx-family/lynx-stack/pull/1211))

- Updated dependencies [[`e44b146`](https://github.com/lynx-family/lynx-stack/commit/e44b146b1bc2b58c0347af7fb4e4157688e07e36), [`5a9b38b`](https://github.com/lynx-family/lynx-stack/commit/5a9b38b783e611aa9761c4cd52191172270c09c7), [`6ca5b91`](https://github.com/lynx-family/lynx-stack/commit/6ca5b9106aade393dfac88914b160960a61a82f2)]:
  - @lynx-js/web-mainthread-apis@0.14.2
  - @lynx-js/web-worker-runtime@0.14.2
  - @lynx-js/web-constants@0.14.2
  - @lynx-js/web-worker-rpc@0.14.2

## 0.14.1

### Patch Changes

- feat: support BTS API `lynx.reportError` && `__SetSourceMapRelease`, now you can use it and handle it in lynx-view error event. ([#1059](https://github.com/lynx-family/lynx-stack/pull/1059))

- fix: under the all-on-ui strategy, reload() will add two page elements. ([#1147](https://github.com/lynx-family/lynx-stack/pull/1147))

- Updated dependencies [[`a64333e`](https://github.com/lynx-family/lynx-stack/commit/a64333ef28228d6b90c32e027f67bef8acbd8432), [`7751375`](https://github.com/lynx-family/lynx-stack/commit/775137521782ca5445f22029c39163c0a63bbfa5), [`b52a924`](https://github.com/lynx-family/lynx-stack/commit/b52a924a2375cb6f7ebafdd8abfbab0254eb2330)]:
  - @lynx-js/web-worker-runtime@0.14.1
  - @lynx-js/web-constants@0.14.1
  - @lynx-js/web-mainthread-apis@0.14.1
  - @lynx-js/web-worker-rpc@0.14.1

## 0.14.0

### Minor Changes

- refactor: the default thread-strategy will be all on ui ([#1105](https://github.com/lynx-family/lynx-stack/pull/1105))

  **This is a breaking change!!!**

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

- fix: lynx-view `updateGlobalProps` method will also update globalProps, so `reload()` will use the latest updated globalProps. ([#1119](https://github.com/lynx-family/lynx-stack/pull/1119))

- feat: supports `lynx.getI18nResource()` and `onI18nResourceReady` event in bts. ([#1088](https://github.com/lynx-family/lynx-stack/pull/1088))

  - `lynx.getI18nResource()` can be used to get i18nResource in bts, it has two data sources:
    - the result of `_I18nResourceTranslation()`
    - lynx-view `updateI18nResources(data: InitI18nResources, options: I18nResourceTranslationOptions)`, it will be matched to the correct i8nResource as a result of `lynx.getI18nResource()`
  - `onI18nResourceReady` event can be used to listen `_I18nResourceTranslation` and lynx-view `updateI18nResources` execution.

- refactor: make the opcode be a plain array ([#1051](https://github.com/lynx-family/lynx-stack/pull/1051))

  #1042

- feat: The error event return value detail of lynx-view adds `sourceMap` value, the type is as follows: ([#1058](https://github.com/lynx-family/lynx-stack/pull/1058))

  ```
  CustomEvent<{
    error: Error;
    sourceMap: {
      offset: {
        line: number;
        col: number;
      };
    };
  }>;
  ```

  This is because web-core adds wrapper at runtime, which causes the stack offset to be different. Now you can calculate the real offset based on it.

- feat: add `updateI18nResources` method of lynx-view. ([#1085](https://github.com/lynx-family/lynx-stack/pull/1085))

  Now you can use `updateI18nResources` to update i18nResources, and then use \_I18nResourceTranslation() to get the updated result.

- fix: --lynx-color will be removed, and if color contains `gradient` it will be processed as transparent. ([#1069](https://github.com/lynx-family/lynx-stack/pull/1069))

- Updated dependencies [[`42ed2e3`](https://github.com/lynx-family/lynx-stack/commit/42ed2e325ff38f781dc88b92cc56093a7a7164ea), [`25a04c9`](https://github.com/lynx-family/lynx-stack/commit/25a04c9e59f4b893227bdead74f2de69f6615cdb), [`0dbb8b1`](https://github.com/lynx-family/lynx-stack/commit/0dbb8b1f580d0700e2b67b92018a7a00d1494837), [`f99de1e`](https://github.com/lynx-family/lynx-stack/commit/f99de1ef60cc5a11eae4fd0acc70a490787d36c9), [`873a285`](https://github.com/lynx-family/lynx-stack/commit/873a2852fa3df9e32c48a6504160bb243540c7b9), [`afacb2c`](https://github.com/lynx-family/lynx-stack/commit/afacb2cbea7feca46c553651000625d0845b2b00), [`1861cbe`](https://github.com/lynx-family/lynx-stack/commit/1861cbead4b373e0511214999b0e100b6285fa9a)]:
  - @lynx-js/web-worker-runtime@0.14.0
  - @lynx-js/web-mainthread-apis@0.14.0
  - @lynx-js/web-constants@0.14.0
  - @lynx-js/offscreen-document@0.1.2
  - @lynx-js/web-worker-rpc@0.14.0

## 0.13.5

### Patch Changes

- refactor: move some internal status to dom's attribute ([#945](https://github.com/lynx-family/lynx-stack/pull/945))

  It's essential for SSR

- refactor: avoid to create many style element for cssog ([#1026](https://github.com/lynx-family/lynx-stack/pull/1026))

- refactor: move component config info to attribute ([#984](https://github.com/lynx-family/lynx-stack/pull/984))

- fix: ensure render starts after dom connected ([#1020](https://github.com/lynx-family/lynx-stack/pull/1020))

- refactor: save dataset on an attribute ([#981](https://github.com/lynx-family/lynx-stack/pull/981))

  On lynx, the `data-*` attributes have different behaviors than the HTMLElement has.

  The dataset will be treated as properties, the key will not be applied the camel-case <-> hyphenate name transformation.

  Before this commit we use it as a runtime data, but after this commit we will use encodeURI(JSON.stringify(dataset)) to encode it as a string.

- refactor: implement mts apis in closure pattern ([#1004](https://github.com/lynx-family/lynx-stack/pull/1004))

- Updated dependencies [[`70b82d2`](https://github.com/lynx-family/lynx-stack/commit/70b82d23744d6b6ec945dff9f8895ab3488ba4c8), [`5651e24`](https://github.com/lynx-family/lynx-stack/commit/5651e24827358963c3261252bcc53c2ad981c13e), [`9499ea9`](https://github.com/lynx-family/lynx-stack/commit/9499ea91debdf73b2d31af0b31bcbc216135543b), [`50f0193`](https://github.com/lynx-family/lynx-stack/commit/50f01933942268b697bf5abe790da86c932f1dfc), [`57bf0ef`](https://github.com/lynx-family/lynx-stack/commit/57bf0ef19f1d79bc52ab6a4f0cd2939e7901d98b), [`5651e24`](https://github.com/lynx-family/lynx-stack/commit/5651e24827358963c3261252bcc53c2ad981c13e), [`0525fbf`](https://github.com/lynx-family/lynx-stack/commit/0525fbf38baa7a977a7a8c66e8a4d8bf34cc3b68), [`b6b87fd`](https://github.com/lynx-family/lynx-stack/commit/b6b87fd11dbc76c28f3b5022aa8c6afeb773d90f), [`c014327`](https://github.com/lynx-family/lynx-stack/commit/c014327ad0cf599b32d4182d95116b46c35f5fa5)]:
  - @lynx-js/web-mainthread-apis@0.13.5
  - @lynx-js/web-constants@0.13.5
  - @lynx-js/offscreen-document@0.1.1
  - @lynx-js/web-worker-runtime@0.13.5
  - @lynx-js/web-worker-rpc@0.13.5

## 0.13.4

### Patch Changes

- feat: lynx-view supports `updateGlobalProps` method, which can be used to update lynx.\_\_globalProps ([#918](https://github.com/lynx-family/lynx-stack/pull/918))

- feat: supports `lynx.getElementById()` && `animate()`. ([#912](https://github.com/lynx-family/lynx-stack/pull/912))

  After this commit, you can use `lynx.getElementById()` to get the element by id, and use `element.animate()` to animate the element.

- Updated dependencies [[`96d3133`](https://github.com/lynx-family/lynx-stack/commit/96d3133b149b61af01c5478f4dc7b0a071137d98), [`75e5b2f`](https://github.com/lynx-family/lynx-stack/commit/75e5b2ff16ecf5f7072a45cd130e653dee747461), [`569618d`](https://github.com/lynx-family/lynx-stack/commit/569618d8e2665f5c9e1672f7ee5900ec2a5179a2), [`f9f88d6`](https://github.com/lynx-family/lynx-stack/commit/f9f88d6fb9c42d3370a6622d9d799d671ffcf1a7)]:
  - @lynx-js/web-mainthread-apis@0.13.4
  - @lynx-js/offscreen-document@0.1.0
  - @lynx-js/web-worker-runtime@0.13.4
  - @lynx-js/web-constants@0.13.4
  - @lynx-js/web-worker-rpc@0.13.4

## 0.13.3

### Patch Changes

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- perf: improve dom operation performance ([#881](https://github.com/lynx-family/lynx-stack/pull/881))

  - code clean for offscreen-document, cut down inheritance levels
  - add `appendChild` method for OffscreenElement, improve performance for append one node
  - bypass some JS getter for dumping SSR string

- fix: worker not released when backgroundWorkerContextCount != 1 ([#845](https://github.com/lynx-family/lynx-stack/pull/845))

- Updated dependencies [[`bb1f9d8`](https://github.com/lynx-family/lynx-stack/commit/bb1f9d845ef2395a0508666701409972e159389d), [`b6e27da`](https://github.com/lynx-family/lynx-stack/commit/b6e27daf865b0627b1c3238228a4fdf65ad87ee3), [`3d716d7`](https://github.com/lynx-family/lynx-stack/commit/3d716d79ae053b225e9bac2bbb036c968f5261e7)]:
  - @lynx-js/offscreen-document@0.0.4
  - @lynx-js/web-mainthread-apis@0.13.3
  - @lynx-js/web-worker-runtime@0.13.3
  - @lynx-js/web-constants@0.13.3
  - @lynx-js/web-worker-rpc@0.13.3

## 0.13.2

### Patch Changes

- feat: allow lynx code to get JS engine provided properties on globalThis ([#786](https://github.com/lynx-family/lynx-stack/pull/786))

  ```
  globalThis.Reflect; // this will be the Reflect Object
  ```

  Note that `assigning to the globalThis` is still not allowed.

- perf: use v8 hint for generated javascript file ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  https://v8.dev/blog/explicit-compile-hints

- feat: add new property `inject-style-rules` for LynxView ([#785](https://github.com/lynx-family/lynx-stack/pull/785))

  This property allows developer to inject some style rules into the shadowroot.

  It's a wrapper of https://developer.mozilla.org/docs/Web/API/CSSStyleSheet/insertRule

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- Updated dependencies [[`03a5f64`](https://github.com/lynx-family/lynx-stack/commit/03a5f64d7d09e38903f5d1c022f36f6e68b6432d), [`6d3d852`](https://github.com/lynx-family/lynx-stack/commit/6d3d8529d0d528419920102ca52da279bbe0f1e0), [`8cdd288`](https://github.com/lynx-family/lynx-stack/commit/8cdd28884288b9456aee3a919d6edbf72da1c67b), [`6d3d852`](https://github.com/lynx-family/lynx-stack/commit/6d3d8529d0d528419920102ca52da279bbe0f1e0)]:
  - @lynx-js/web-mainthread-apis@0.13.2
  - @lynx-js/web-worker-runtime@0.13.2
  - @lynx-js/web-constants@0.13.2
  - @lynx-js/offscreen-document@0.0.3
  - @lynx-js/web-worker-rpc@0.13.2

## 0.13.1

### Patch Changes

- fix: some inline style properties cause crash ([#647](https://github.com/lynx-family/lynx-stack/pull/647))

  add support for the following css properties

  - mask
  - mask-repeat
  - mask-position
  - mask-clip
  - mask-origin
  - mask-size
  - gap
  - column-gap
  - row-gap
  - image-rendering
  - hyphens
  - offset-path
  - offset-distance

- feat: support touch events for MTS ([#641](https://github.com/lynx-family/lynx-stack/pull/641))

  now we support

  - main-thread:bindtouchstart
  - main-thread:bindtouchend
  - main-thread:bindtouchmove
  - main-thread:bindtouchcancel

- feat: add SystemInfo.screenWidth and SystemInfo.screenHeight ([#641](https://github.com/lynx-family/lynx-stack/pull/641))

- Updated dependencies [[`c9ccad6`](https://github.com/lynx-family/lynx-stack/commit/c9ccad6b574c98121149d3e9d4a9a7e97af63d91), [`9ad394e`](https://github.com/lynx-family/lynx-stack/commit/9ad394ea9ef28688a3b810b4051868b2a28eb7de), [`f4cfb70`](https://github.com/lynx-family/lynx-stack/commit/f4cfb70606d46cd4017254c326095432f9c6bcb8), [`c9ccad6`](https://github.com/lynx-family/lynx-stack/commit/c9ccad6b574c98121149d3e9d4a9a7e97af63d91), [`839d61c`](https://github.com/lynx-family/lynx-stack/commit/839d61c8a329ed1e265fe2edc12a702e9592f743)]:
  - @lynx-js/offscreen-document@0.0.2
  - @lynx-js/web-mainthread-apis@0.13.1
  - @lynx-js/web-worker-runtime@0.13.1
  - @lynx-js/web-constants@0.13.1
  - @lynx-js/web-worker-rpc@0.13.1

## 0.13.0

### Patch Changes

- refactor: isolate SystemInfo ([#628](https://github.com/lynx-family/lynx-stack/pull/628))

  Never assign `SystemInfo` on worker's self object.

- feat: support thread strategy `all-on-ui` ([#625](https://github.com/lynx-family/lynx-stack/pull/625))

  ```html
  <lynx-view thread-strategy="all-on-ui"></lynx-view>
  ```

  This will make the lynx's main-thread run on the UA's main thread.

  Note that the `all-on-ui` does not support the HMR & chunk splitting yet.

- fix(web): css selector not work for selectors with combinator and pseudo-class on WEB ([#608](https://github.com/lynx-family/lynx-stack/pull/608))

  like `.parent > :not([hidden]) ~ :not([hidden])`

  you will need to upgrade your `react-rsbuild-plugin` to fix this issue

- Updated dependencies [[`4ee0465`](https://github.com/lynx-family/lynx-stack/commit/4ee0465f6e5846a0d038b49d2a7c95e87c9e5c77), [`74b5bd1`](https://github.com/lynx-family/lynx-stack/commit/74b5bd15339b70107a7c42525494da46e8f8f6bd), [`06bb78a`](https://github.com/lynx-family/lynx-stack/commit/06bb78a6b93d4a7be7177a6269dd4337852ce90d), [`5a3d9af`](https://github.com/lynx-family/lynx-stack/commit/5a3d9afe52ba639987db124ca35580261e0718b5), [`5269cab`](https://github.com/lynx-family/lynx-stack/commit/5269cabef7609159bdd0dd14a03c5da667907424), [`74b5bd1`](https://github.com/lynx-family/lynx-stack/commit/74b5bd15339b70107a7c42525494da46e8f8f6bd), [`2b069f8`](https://github.com/lynx-family/lynx-stack/commit/2b069f8786c95bdb9ac1f35091f05f7fd3b52225)]:
  - @lynx-js/web-mainthread-apis@0.13.0
  - @lynx-js/web-worker-runtime@0.13.0
  - @lynx-js/web-constants@0.13.0
  - @lynx-js/offscreen-document@0.0.1
  - @lynx-js/web-worker-rpc@0.13.0

## 0.12.0

### Minor Changes

- feat: improve compatibility for chrome 108 & support linear-gradient for nested x-text ([#590](https://github.com/lynx-family/lynx-stack/pull/590))

  **This is a breaking change**

  - Please upgrade your `@lynx-js/web-elements` to >=0.6.0
  - Please upgrade your `@lynx-js/web-core` to >=0.12.0
  - The compiled lynx template json won't be impacted.

  On chrome 108, the `-webkit-background-clip:text` cannot be computed by a `var(--css-var-value-text)`

  Therefore we move the logic into style transformation logic.

  Now the following status is supported

  ```
  <text style="color:linear-gradient()">
    <text>
    <text>
  </text>
  ```

### Patch Changes

- feat: allow user to implement custom template load function ([#587](https://github.com/lynx-family/lynx-stack/pull/587))

  ```js
  lynxView.customTemplateLoader = (url) => {
    return (await (await fetch(url, {
      method: 'GET',
    })).json());
  };
  ```

- feat: support mts event with target methods ([#564](https://github.com/lynx-family/lynx-stack/pull/564))

  After this commit, developers are allowed to invoke `event.target.setStyleProperty` in mts handler

- fix: crash on removing a id attribute ([#582](https://github.com/lynx-family/lynx-stack/pull/582))

- Updated dependencies [[`f1ca29b`](https://github.com/lynx-family/lynx-stack/commit/f1ca29bd766377dd46583f15e1e75bca447699cd)]:
  - @lynx-js/web-worker-runtime@0.12.0
  - @lynx-js/web-constants@0.12.0
  - @lynx-js/web-worker-rpc@0.12.0

## 0.11.0

### Minor Changes

- feat: upgrade @lynx-js/lynx-core to 0.1.2 ([#465](https://github.com/lynx-family/lynx-stack/pull/465))

  refactor some internal logic

  - \_\_OnLifeCycleEvent
  - \_\_OnNativeAppReady

### Patch Changes

- feat: support mts event handler (1/n) ([#495](https://github.com/lynx-family/lynx-stack/pull/495))

  now the main-thread:bind handler could be invoked. The params of the handler will be implemented later.

- feat: allow multi lynx-view to share bts worker ([#520](https://github.com/lynx-family/lynx-stack/pull/520))

  Now we allow users to enable so-called "shared-context" feature on the Web Platform.

  Similar to the same feature for Lynx iOS/Android, this feature let multi lynx cards to share one js context.

  The `lynx.getSharedData` and `lynx.setSharedData` are also supported in this commit.

  To enable this feature, set property `lynxGroupId` or attribute `lynx-group-id` before a lynx-view starts rendering. Those card with same context id will share one web worker for the bts scripts.

- perf: dispatchLynxViewEventEndpoint is a void call ([#506](https://github.com/lynx-family/lynx-stack/pull/506))

- Updated dependencies [[`ea42e62`](https://github.com/lynx-family/lynx-stack/commit/ea42e62fbcd5c743132c3e6e7c4851770742d544), [`a0f5ca4`](https://github.com/lynx-family/lynx-stack/commit/a0f5ca4ea0895ccbaa6aa63f449f53a677a1cf73)]:
  - @lynx-js/web-worker-runtime@0.11.0
  - @lynx-js/web-constants@0.11.0
  - @lynx-js/web-worker-rpc@0.11.0

## 0.10.1

### Patch Changes

- docs: fix documents about lynx-view's properties ([#412](https://github.com/lynx-family/lynx-stack/pull/412))

  Attributes should be hyphen-name: 'init-data', 'global-props'.

  now all properties has corresponding attributes.

- feat: onNapiModulesCall function add new param: `dispatchNapiModules`, napiModulesMap val add new param: `handleDispatch`. ([#414](https://github.com/lynx-family/lynx-stack/pull/414))

  Now you can use them to actively communicate to napiModules (background thread) in onNapiModulesCall (ui thread).

- Updated dependencies [[`1af3b60`](https://github.com/lynx-family/lynx-stack/commit/1af3b6052ab27f98bf0e4d1b0ec9f7d9e88e0afc)]:
  - @lynx-js/web-constants@0.10.1
  - @lynx-js/web-worker-runtime@0.10.1
  - @lynx-js/web-worker-rpc@0.10.1

## 0.10.0

### Minor Changes

- feat: rewrite the main thread Element PAPIs ([#343](https://github.com/lynx-family/lynx-stack/pull/343))

  In this commit we've rewritten the main thread apis.

  The most highlighted change is that

  - Before this commit we send events directly to bts
  - After this change, we send events to mts then send them to bts with some data combined.

### Patch Changes

- refactor: timing system ([#378](https://github.com/lynx-family/lynx-stack/pull/378))

  Now we moved the timing system to the background thread.

- feat: support `defaultOverflowVisible` config ([#406](https://github.com/lynx-family/lynx-stack/pull/406))

- fix(web): rsbuild will bundle 2 exactly same chunk for two same `new Worker` stmt ([#372](https://github.com/lynx-family/lynx-stack/pull/372))

  the bundle size will be optimized about 28.2KB

- fix: inline style will be removed for value number `0` ([#368](https://github.com/lynx-family/lynx-stack/pull/368))

  the inline style value could be incorrectly removed for number value `0`;

  For example, `flex-shrink:0` may be ignored.

- feat: The onNapiModulesCall function of lynx-view provides the fourth parameter: `lynxView`, which is the actual lynx-view DOM. ([#350](https://github.com/lynx-family/lynx-stack/pull/350))

- fix: publicComponentEvent args order ([#401](https://github.com/lynx-family/lynx-stack/pull/401))

- Updated dependencies [[`3a8dabd`](https://github.com/lynx-family/lynx-stack/commit/3a8dabd877084c15db1404c912dd8a19c7a0fc59), [`a521759`](https://github.com/lynx-family/lynx-stack/commit/a5217592f5aebea4b17860e729d523ecabb5f691), [`890c6c5`](https://github.com/lynx-family/lynx-stack/commit/890c6c51470c82104abb1049681f55e5d97cf9d6)]:
  - @lynx-js/web-worker-runtime@0.10.0
  - @lynx-js/web-constants@0.10.0
  - @lynx-js/web-worker-rpc@0.10.0

## 0.9.1

### Patch Changes

- feat: remove extra div #lynx-view-root ([#311](https://github.com/lynx-family/lynx-stack/pull/311))

  In this commit we've re-implemented the lynx-view's auto-size. Now we use the `contain:content` instead of `resizeObserver`.

- Updated dependencies []:
  - @lynx-js/web-constants@0.9.1
  - @lynx-js/web-worker-rpc@0.9.1
  - @lynx-js/web-worker-runtime@0.9.1

## 0.9.0

### Minor Changes

- feat: `nativeModulesUrl` of lynx-view is changed to `nativeModulesMap`, and the usage is completely aligned with `napiModulesMap`. ([#220](https://github.com/lynx-family/lynx-stack/pull/220))

  "warning: This is a breaking change."

  `nativeModulesMap` will be a map: key is module-name, value should be a esm url which export default a
  function with two parameters(you never need to use `this`):

  - `NativeModules`: oriented `NativeModules`, which you can use to call
    other Native-Modules.

  - `NativeModulesCall`: trigger `onNativeModulesCall`, same as the deprecated `this.nativeModulesCall`.

  example:

  ```js
  const nativeModulesMap = {
    CustomModule: URL.createObjectURL(
      new Blob(
        [
          `export default function(NativeModules, NativeModulesCall) {
      return {
        async getColor(data, callback) {
          const color = await NativeModulesCall('getColor', data);
          callback(color);
        },
      }
    };`,
        ],
        { type: 'text/javascript' },
      ),
    ),
  };
  lynxView.nativeModulesMap = nativeModulesMap;
  ```

  In addition, we will use Promise.all to load `nativeModules`, which will optimize performance in the case of multiple modules.

- refractor: remove entryId concept ([#217](https://github.com/lynx-family/lynx-stack/pull/217))

  After the PR #198
  All contents are isolated by a shadowroot.
  Therefore we don't need to add the entryId selector to avoid the lynx-view's style taking effect on the whole page.

### Patch Changes

- refactor: code clean ([#266](https://github.com/lynx-family/lynx-stack/pull/266))

- refactor: clean the decodeOperations implementation ([#261](https://github.com/lynx-family/lynx-stack/pull/261))

- fix: When the width and height of lynx-view are not auto, the width and height of the `lynx-tag="page"` need to be correctly set to 100%. ([#228](https://github.com/lynx-family/lynx-stack/pull/228))

- refactor: remove customelement defined detecting logic ([#247](https://github.com/lynx-family/lynx-stack/pull/247))

  Before this commit, for those element with tag without `-`, we always try to detect if the `x-${tagName}` is defined.

  After this commit, we pre-define a map(could be override by the `overrideLynxTagToHTMLTagMap`) to make that transformation for tag name.

  This change is a path to SSR and the MTS support.

- fix: 'error' event for main-thread \_reportError ([#283](https://github.com/lynx-family/lynx-stack/pull/283))

- Updated dependencies [[`5b5e090`](https://github.com/lynx-family/lynx-stack/commit/5b5e090fdf0e896f1c38a49bf3ed9889117c4fb8), [`b844e75`](https://github.com/lynx-family/lynx-stack/commit/b844e751f566d924256365d37aec4c86c520ec00), [`53230f0`](https://github.com/lynx-family/lynx-stack/commit/53230f012216f3a627853e11d544e4be175c5b9b), [`6f16827`](https://github.com/lynx-family/lynx-stack/commit/6f16827d1f4d7364870d354fc805a8868c110f1e), [`d2d55ef`](https://github.com/lynx-family/lynx-stack/commit/d2d55ef9fe438c35921d9db0daa40d5228822ecc)]:
  - @lynx-js/web-worker-runtime@0.9.0
  - @lynx-js/web-constants@0.9.0
  - @lynx-js/web-worker-rpc@0.9.0

## 0.8.0

### Minor Changes

- refactor: remove web-elements/lazy and loadNewTag ([#123](https://github.com/lynx-family/lynx-stack/pull/123))

  - remove @lynx-js/web-elements/lazy
  - remove loadElement
  - remove loadNewTag callback

  **This is a breaking change**

  Now we removed the default lazy loading preinstalled in web-core

  Please add the following statement in your web project

  ```
  import "@lynx-js/web-elements/all";
  ```

- feat: use shadowroot to isolate one lynx-view ([#198](https://github.com/lynx-family/lynx-stack/pull/198))

  Before this commit, we have been detecting if current browser supports the `@scope` rule.
  This allows us to scope one lynx-view's styles.

  After this commit we always create a shadowroot to scope then.

  Also for the new shadowroot pattern, we add a new **attribute** `inject-head-links`.
  By default, we will iterate all `<link rel="stylesheet">` in the `<head>`, and use `@import url()` to import them inside the shadowroot.
  Developers could add a `inject-head-links="false"` to disable this behavior.

- feat: never add the x-enable-xx-event attributes ([#157](https://github.com/lynx-family/lynx-stack/pull/157))

  After this commit, we update the reqirement of the version of `@lynx-js/web-elements` to `>=0.3.1`

### Patch Changes

- feat: add pixelRatio of SystemInfo, now you can use `SystemInfo.pixelRatio`. ([#150](https://github.com/lynx-family/lynx-stack/pull/150))

- Improve LynxView resize observer cleanup ([#124](https://github.com/lynx-family/lynx-stack/pull/124))

- feat: add two prop of lynx-view about `napiLoader`: ([#173](https://github.com/lynx-family/lynx-stack/pull/173))

  - `napiModulesMap`: [optional] the napiModule which is called in lynx-core. key is module-name, value is esm url.

  - `onNapiModulesCall`: [optional] the NapiModule value handler.

  **Warning:** This is the internal implementation of `@lynx-js/lynx-core`. In most cases, this API is not required for projects.

  1. The `napiModulesMap` value should be a esm url which export default a function with two parameters:

  - `NapiModules`: oriented `napiModulesMap`, which you can use to call other Napi-Modules

  - `NapiModulesCall`: trigger `onNapiModulesCall`

  example:

  ```js
  const color_environment = URL.createObjectURL(
    new Blob(
      [
        `export default function(NapiModules, NapiModulesCall) {
    return {
      getColor() {
        NapiModules.color_methods.getColor({ color: 'green' }, color => {
          console.log(color);
        });
      },
      ColorEngine: class ColorEngine {
        getColor(name) {
          NapiModules.color_methods.getColor({ color: 'green' }, color => {
            console.log(color);
          });
        }
      },
    };
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );

  const color_methods = URL.createObjectURL(
    new Blob(
      [
        `export default function(NapiModules, NapiModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NapiModulesCall('getColor', data);
        callback(color);
      },
    };
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );

  lynxView.napiModuleMap = {
    color_environment: color_environment,
    color_methods: color_methods,
  };
  ```

  2. The `onNapiModulesCall` function has three parameters:

  - `name`: the first parameter of `NapiModulesCall`, the function name
  - `data`: the second parameter of `NapiModulesCall`, data
  - `moduleName`: the module-name of the called napi-module

  ```js
  lynxView.onNapiModulesCall = (name, data, moduleName) => {
    if (name === 'getColor' && moduleName === 'color_methods') {
      return data.color;
    }
  };
  ```

- Updated dependencies [[`eab1328`](https://github.com/lynx-family/lynx-stack/commit/eab1328a83797fc903255c984d9f39537b9138b9), [`e9e8370`](https://github.com/lynx-family/lynx-stack/commit/e9e8370e070a50cbf65a4ebc46c2e37ea1e0be40), [`ec4e1ce`](https://github.com/lynx-family/lynx-stack/commit/ec4e1ce0d7612d6c0701792a46c78cd52130bad4), [`f0a717c`](https://github.com/lynx-family/lynx-stack/commit/f0a717c630700e16ab0af7f1fe370fd60ac75b30)]:
  - @lynx-js/web-worker-runtime@0.8.0
  - @lynx-js/web-constants@0.8.0
  - @lynx-js/web-worker-rpc@0.8.0

## 0.7.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- fix: some valus should be updateable by global scope ([#130](https://github.com/lynx-family/lynx-stack/pull/130))

  Now we add an allowlist to allow some identifiers could be updated by globalThis.

  For those values in the allowlist:

  ```
  globalThis.foo = 'xx';
  console.log(foo); //'xx'
  ```

- refactor: isolate the globalThis in mts ([#90](https://github.com/lynx-family/lynx-stack/pull/90))

  After this commit, developers' mts code won't be able to access the globalThis

  The following usage will NOT work

  ```
  globalThis.foo = () =>{};
  foo();//crash
  ```

- refractor: improve some internal logic for element creating in MTS ([#71](https://github.com/lynx-family/lynx-stack/pull/71))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb), [`2044571`](https://github.com/lynx-family/lynx-stack/commit/204457166531dae6e9f653db56b14187553b7666), [`7da7601`](https://github.com/lynx-family/lynx-stack/commit/7da7601f00407970c485046ad73eeb8534aaa4f6)]:
  - @lynx-js/web-worker-runtime@0.7.1
  - @lynx-js/web-worker-rpc@0.7.1
  - @lynx-js/web-constants@0.7.1

## 0.7.0

### Minor Changes

- 1abf8f0: feat(web):

  **This is a breaking change**

  1. A new param for `lynx-view`: `nativeModulesUrl`, which allows you to pass an esm url to add a new module to `NativeModules`. And we bind the `nativeModulesCall` method to each function on the module, run `this.nativeModulesCall()` to trigger onNativeModulesCall.

  ```typescript
  export type NativeModuleHandlerContext = {
    nativeModulesCall: (name: string, data: Cloneable) => Promise<Cloneable>;
  };
  ```

  a simple case:

  ```js
  lynxView.nativeModules = URL.createObjectURL(
    new Blob(
      [
        `export default {
    myNativeModules: {
      async getColor(data, callback) {
        // trigger onNativeModulesCall and get the result
        const color = await this.nativeModulesCall('getColor', data);
        // return the result to caller
        callback(color);
      },
    }
  };`,
      ],
      { type: 'text/javascript' },
    ),
  );
  ```

  2. `onNativeModulesCall` is no longer the value handler of `NativeModules.bridge.call`, it will be the value handler of all `NativeModules` modules.

  **Warning: This is a breaking change.**

  Before this commit, you listen to `NativeModules.bridge.call('getColor')` like this:

  ```js
  lynxView.onNativeModulesCall = (name, data, callback) => {
    if (name === 'getColor') {
      callback(data.color);
    }
  };
  ```

  Now you should use it like this:

  ```js
  lynxView.onNativeModulesCall = (name, data, moduleName) => {
    if (name === 'getColor' && moduleName === 'bridge') {
      return data.color;
    }
  };
  ```

  You need to use `moduleName` to determine the NativeModules-module. And you don’t need to run callback, just return the result!

### Patch Changes

- Updated dependencies [1abf8f0]
  - @lynx-js/web-worker-runtime@0.7.0
  - @lynx-js/web-constants@0.7.0
  - @lynx-js/web-worker-rpc@0.7.0

## 0.6.2

### Patch Changes

- 15381ca: fix: the 'page' should have default style width:100%; height:100%;
- 0412db0: fix: The runtime wrapper parameter name is changed from `runtime` to `lynx_runtime`.

  This is because some project logic may use `runtime`, which may cause duplication of declarations.

- 2738fdc: feat: support linear-direction
- Updated dependencies [0412db0]
- Updated dependencies [085b99e]
  - @lynx-js/web-constants@0.6.2
  - @lynx-js/web-worker-runtime@0.6.2
  - @lynx-js/web-worker-rpc@0.6.2

## 0.6.1

### Patch Changes

- 9c25c3d: feat: support synchronously chunk loading

  now the `lynx.requireModule` is available in bts.

- Updated dependencies [62b7841]
  - @lynx-js/web-worker-runtime@0.6.1
  - @lynx-js/web-constants@0.6.1
  - @lynx-js/web-worker-rpc@0.6.1

## 0.6.0

### Minor Changes

- e406d69: refractor: update output json format

  **This is a breaking change**

  Before this change the style info is dump in Javascript code.

  After this change the style info will be pure JSON data.

  Now we're using the css-serializer tool's output only. If you're using plugins for it, now they're enabled.

### Patch Changes

- bfae2ab: feat: We will only preheat the mainThreadWorker now, and the backgroundWorker will be created when renderPage is called, which can save some memory.

  Before this change, We will preheat two workers: mainThreadWorker and backgroundWorker.

- b80e2bb: feat: add reload() method
- Updated dependencies [e406d69]
  - @lynx-js/web-worker-runtime@0.6.0
  - @lynx-js/web-constants@0.6.0
  - @lynx-js/web-worker-rpc@0.6.0

## 0.5.1

### Patch Changes

- c49b1fb: feat: updateData api needs to have the correct format, now you can pass a callback.
- ee340da: feat: add SystemInfo.platform as 'web'. now you can use `SystemInfo.platform`.
- b5ef20e: feat: updateData should also call `updatePage` in main-thread.
- Updated dependencies [c49b1fb]
- Updated dependencies [ee340da]
- Updated dependencies [b5ef20e]
  - @lynx-js/web-constants@0.5.1
  - @lynx-js/web-worker-runtime@0.5.1
  - @lynx-js/web-worker-rpc@0.5.1

## 0.5.0

### Minor Changes

- 7b84edf: feat: introduce new output chunk format

  **This is a breaking change**

  After this commit, we new introduce a new output format for web platform.

  This new output file is a JSON file, includes all essential info.

  Now we'll add the chunk global scope wrapper on runtime, this will help us to provide a better backward compatibility.

  Also we have a intergrated output file cache for one session.

  Now your `output.filename` will work.

  The split-chunk feature has been temporary removed until the rspeedy team supports this feature for us.

### Patch Changes

- 3050faf: refractor: housekeeping
- dc6216c: feat: add selectComponent of nativeApp
- 5eaa052: refractor: unifiying worker runtime
- Updated dependencies [04607bd]
- Updated dependencies [3050faf]
- Updated dependencies [7b84edf]
- Updated dependencies [e0f0793]
  - @lynx-js/web-worker-rpc@0.5.0
  - @lynx-js/web-worker-runtime@0.5.0
  - @lynx-js/web-constants@0.5.0

## 0.4.2

### Patch Changes

- 958efda: feat(web): bundle background.js into main-thread.js for web

  To enable this feature:

  1. set the performance.chunkSplit.strategy to `all-in-one`
  2. use the `mode:'production'` to build

  The output will be only one file.

- 283e6bd: fix: invoke callback should be called after invoke && the correct callback params should be passed to callback function.

  Before this commit the invoke() success and fail callback function was be called.

- 8d583f5: refactor: organize internal dependencies
- 8cd3f65: feat: add triggerComponentEvent of NativeApp.
- 38f21e4: fix: avoid card freezing on the background.js starts too fast

  if the background thread starts too fast, Reactlynx runtime will assign an lazy handler first and then replace it by the real handler.

  Before this commit we cannot handle such "replace" operation for cross-threading call.

  Now we fix this issue

- 8714140: fix(web): check and assign globalThis property of nativeTTObject
- 7c3c2a1: feat: support `sendGlobalEvent` method.

  Now developers can do this:

  ```javascript
  const lynxView = createLynxView(configs);
  lynxView.sendGlobalEvent(eventName, params);
  ```

- 168b4fa: feat: rename CloneableObject to Cloneable, Now its type refers to a structure that can be cloned; CloneableObject type is added, which only refers to object types that can be cloned.
- Updated dependencies [8d583f5]
- Updated dependencies [38f21e4]
- Updated dependencies [168b4fa]
  - @lynx-js/web-worker-rpc@0.4.2
  - @lynx-js/web-constants@0.4.2
  - @lynx-js/web-mainthread-apis@0.4.2

## 0.4.1

### Patch Changes

- 2a49a42: fix(web): gen 2nd parameter for updateData
- 084eb17: feat: At any time, a worker is reserved for preheating subsequent cards.
- d3eac58: fix(web): refractor worker terminate system
- de2f62b: fix(web): performance doesn't handle main-thread timings correctly
- e72aae0: feat(web): support onNativeAppReady
- 27c0e6e: feat(web): infer the cssId if parent component unique id is set

  ```
  (The following info is provided for DSL maintainers)

  - the 'infer' operation only happens on fiber element creating, changing the parent's cssId, changing children's parent component unique id will cause an issue
  - __SetCSSId will be called for setting inferred cssId value. Runtime could use the same `__SetCSSId` to overwrite this value.
  - cssId: `0` will be treated as an void value
  ```

- 500057e: fix: `__GetElementUniqueID` return -1 for illegal param

  (Only DSL developers need to care this)

- Updated dependencies [27c0e6e]
- Updated dependencies [500057e]
  - @lynx-js/web-mainthread-apis@0.4.1
  - @lynx-js/web-constants@0.4.1

## 0.4.0

### Minor Changes

- a3c39d6: fix: enableRemoveCSSScope:false with descendant combinator does not work

  **THIS IS A BREAKING CHANGE**

  Before this commit, we will add a [lynx-css-id=""] selector at the beginning of all selector, like this

  ```css
  [lynx-css-id="12345"].bg-pink {
    background-color: pink;
  }
  ```

  However, for selector with descendant combinator, this will cause an issue

  ```css
  [lynx-css-id="12345"].light .bg-pink {
    background-color: pink;
  }
  ```

  What we actually want is

  ```css
  .light .bg-pink[lynx-css-id="12345"] {
    background-color: pink;
  }
  ```

  After this commit, we changed the data structor of the styleinfo which bundled into the main-thread.js.
  This allows us to add class selectors at the begining of selector and the end of plain selector(before the pseudo part).

  **THIS IS A BREAKING CHANGE**

  After this version, you will need to upgrade the version of @lynx-js/web-core^0.4.0

- 2dd0aef: feat: support performance apis for lynx

  - support `nativeApp.generatePipelineOptions`
  - support `nativeApp.onPipelineStart`
  - support `nativeApp.markPipelineTiming`
  - support `nativeApp.bindPipelineIdWithTimingFlag`

  for lynx developers, the following apis are now supported

  - `lynx.performance.addTimingListener`
  - `__lynx_timing_flag` attribute

  for lynx-view container developers

  - `mainChunkReady` event has been removed
  - add a new `timing` event

### Patch Changes

- 3123b86: fix(web): do not use @scope for safari for enableCSSSelector:false

  We this there is a bug in webkit.

- 585d55a: feat(web): support animation-_ and transition-_ event

  Now we will append the correct `event.params` property for animation events and transition events

  - @lynx-js/web-constants@0.4.0
  - @lynx-js/web-mainthread-apis@0.4.0

## 0.3.1

### Patch Changes

- 9f2ad5e: feat: add worker name for debug

  before this commit, all web workers will be named as `main-thread` or `worker-thread`

  now we name based on it's entryId

- 583c003: fix:

  1. custom-element pre-check before define to avoid duplicate registration.

  2. make sure @lynx-js/lynx-core is bundled into @lynx-js/web-core.

- 61a7014: refractor: migrate to publishEvent
- c3726e8: feat: pre heat the worker runtime at the very beginning

  We cecently found that the worker booting takes some time.

  Here we boot the first 2 workers for the first lynx-view.

  This will help use to improve performance

  - @lynx-js/web-constants@0.3.1
  - @lynx-js/web-mainthread-apis@0.3.1

## 0.3.0

### Minor Changes

- 267c935: feat: make cardType could be configurable
- f44c589: feat: support exports field of the lynx-core

### Patch Changes

- 884e31c: fix: bind lazy rpc handlers
- 6e873bc: fix: incorrect parent component id value on publishComponentEvent
- Updated dependencies [d255d24]
- Updated dependencies [6e873bc]
- Updated dependencies [267c935]
  - @lynx-js/web-mainthread-apis@0.3.0
  - @lynx-js/web-constants@0.3.0

## 0.2.0

### Minor Changes

- 32d47c4: chore: upgrate dep version of web-core

### Patch Changes

- 272db24: refractor: the main-thread worker will be dedicated for every lynx view
  - @lynx-js/web-constants@0.2.0
  - @lynx-js/web-mainthread-apis@0.2.0

## 0.1.0

### Minor Changes

- 78638dc: feat: support invokeUIMethod and setNativeProps
- 06fe3cd: feat: support splitchunk and lynx.requireModuleAsync

  - support splitchunk option of rspeedy
  - add implementation for lynx.requireModuleAsync for both main-thread and background-thread
  - mark worker `ready` after \_OnLifeCycleEvent is assigned

  close #96

- fe0d06f: feat: add onError callback to `LynxCard`

  The onError callback is a wrapper of the ElementAPI `_reportError`.

  This allows the externel caller to detect errors.

- 66ce343: feat: support config `defaultDisplayLinear`
- c43f436: feat: add `dispose()` method for lynxview
- 068f677: feat: suppport createSelectorQuery
- 3547621: feat(web): use `<lynx-wrapper/>` to replace `<div style="display:content"/>`
- d551d81: feat: support customSection

  - support lynx.getCustomSection
  - support lynx.getCustomSectionSync

- f1ddb5a: feat: never need to pass background entry url
- b323923: feat(web): support **ReplaceElement, **CreateImage, \_\_CreateScrollView
- 3a370ab: feat: support global identifier `lynxCoreInject` and `SystemInfo`
- 23e6fa5: feat(web): support enableCSSSelector:false

  We will extract all selectors with single class selector and rules in a Json object.

  These classes will be applied on runtime.

  **About enableCSSSelector:false**

  This flag changes the behaviour of cascading. It provide a way to do this

  ```jsx
  <view class='class-a class-b' />;
  ```

  The class-b will override (cascading) styles of class-a.

- 39cf3ae: feat: improve performance for supporting linear layout

  Before this commit, we'll use `getComputedStyle()` to find out if a dom is a linear container.

  After this commit, we'll use the css variable cyclic toggle pattern and `@container style()`

  This feature requires **Chrome 111, Safari 18**.

  We'll provide a fallback implementation for firefox and legacy browsers.

  After this commit, your `flex-direction`, `flex-shrink`, `flex`, `flex-grow`, `flex-basis` will be transformed to a css variable expression.

- 2973ba5: feat: move lynx main-thread to web worker

  Move The Mainthread of Lynx to a web worker.

  This helps the performance.

- 6327fa8: feat(web): add support for \_\_CreateWrapperElement
- 2047658: feat: support exposure system

  support the following APIs:

  - lynx.stopExposure({sendEvent?:boolean})
  - lynx.resumeExposure()
  - GlobalEvent: 'exposure'
  - GlobalEvent: 'disexposure'
  - uiappear event
  - uidisappear event

- 269bf61: feat: support rspeedy layer model and support sharing chunk between main and background
- c95430c: feat: support `updateData`

  Now developers can do this:

  ```javascript
  const lynxView = createLynxView(configs);
  lynxView.updateData(newData);
  ```

- 29f24aa: feat(web): support removeCSSScope:false

  - add element api `__SetCSSId`
  - add new WebpackPlugin `@lynx-js/web-webpack-plugin`
  - add support for removeCSSSCope
  - pass all configs via thie \*.lepus.js
  - support to scope styles of lynx card for browsers do not support `@scope` and nesting

- 216ed68: feat: add a new <lynx-view> element

  ```
  * @param {string} url [required] The url of the entry of your Lynx card
  * @param {Cloneable} globalProps [optional] The globalProps value of this Lynx card
  * @param {Cloneable} initData [optional] The initial data of this Lynx card
  * @param {Record<string,string>} overrideLynxTagToHTMLTagMap [optional] use this property/attribute to override the lynx tag -> html tag map
  * @param {NativeModulesCallHandler} onNativeModulesCall [optional] the NativeModules.bridge.call value handler. Arguments will be cached before this property is assigned.
  *
  * @property entryId the currently Lynx view entryId.
  *
  * @event error lynx card fired an error
  * @event mainchunkready performance event. All mainthread chunks are ready
  ```

  - HTML Exmaple

  Note that you should declarae the size of lynx-view

  ```html
  <lynx-view
    url="https://path/to/main-thread.js"
    rawData="{}"
    globalProps="{}"
    style="height:300px;width:300px"
  >
  </lynx-view>
  ```

  - React 19 Example

  ```jsx
  <lynx-view url={myLynxCardUrl} rawData={{}} globalProps={{}} style={{height:'300px', width:'300px'}}>
  </lynx-vew>
  ```

- f8d1d98: feat: allow custom elements to be lazy loaded

  After this commit, we'll allow developer to define custom elements lazy.

  A new api `onElementLoad` will be added to the `LynxCard`.

  Once a new element is creating, it will be called with the tag name.

  There is also a simple way to use this feature

  ```javascript
  import { LynxCard } from '@lynx-js/web-core';
  import { loadElement } from '@lynx-js/web-elements/lazy';
  import '@lynx-js/web-elements/index.css';
  import '@lynx-js/web-core/index.css';
  import './index.css';

  const lynxcard = new LynxCard({
    ...beforeConfigs,
    onElementLoad: loadElement,
  });
  ```

- 906e894: feat(web): support dataset & \_\_AddDataset
- 6e003e8: feat(web): support linear layout and add tests
- 2b85d73: feat(web): support Nativemodules.bridge.call
- 0fc1826: feat(web): add \_\_CreateListElement Element API

### Patch Changes

- 238df71: fix(web): fix bugs of Elements
  includes:
  **AddClass,
  **ReplaceElements,
  **GetElementUniqueID,
  **GetConfig,
  **GetChildren,
  **FlushElementTree,
  \_\_SetInlineStyles
- 32952fb: chore: bump target to esnext
- f900b75: refactor: do not use inline style to apply css-in-js styles

  Now you will see your css-in-js styles applied under a `[lynx-unique-id="<id>"]` selector.

- 9c23659: fix(web): \_\_SetAttribute allows the value to be null
- d3acc7b: fix: we should call \_\_FlushElementTree after renderPage
- 314cb44: fix(web): x-textarea replace blur,focus with lynxblur,lynxfocus.
- e170052: chore: remove tslib

  We provide ESNext output for this lib.

- Updated dependencies [987da15]
- Updated dependencies [3e66349]
- Updated dependencies [2b7a4fe]
- Updated dependencies [461d965]
- Updated dependencies [2973ba5]
- Updated dependencies [7ee0dc1]
- Updated dependencies [7c752d9]
- Updated dependencies [29e4684]
- Updated dependencies [068f677]
- Updated dependencies [3547621]
- Updated dependencies [bed4f24]
- Updated dependencies [33691cd]
- Updated dependencies [2047658]
- Updated dependencies [b323923]
- Updated dependencies [39cf3ae]
- Updated dependencies [2973ba5]
- Updated dependencies [917e496]
- Updated dependencies [532380d]
- Updated dependencies [a41965d]
- Updated dependencies [f900b75]
- Updated dependencies [2e0a780]
- Updated dependencies [a7a222b]
- Updated dependencies [f8d1d98]
- Updated dependencies [c04669b]
- Updated dependencies [81be6cf]
- Updated dependencies [f8d1d98]
- Updated dependencies [5018d8f]
- Updated dependencies [c0a482a]
- Updated dependencies [314cb44]
- Updated dependencies [8c6eeb9]
- Updated dependencies [c43f436]
- Updated dependencies [67a70ac]
- Updated dependencies [e0854a8]
- Updated dependencies [e170052]
- Updated dependencies [e86bba0]
- Updated dependencies [1fe49a2]
- Updated dependencies [f0a50b6]
  - @lynx-js/web-elements@0.1.0
  - @lynx-js/web-constants@0.1.0
  - @lynx-js/lynx-core@0.0.1
  - @lynx-js/web-mainthread-apis@0.1.0
