# @lynx-js/web-mainthread-apis

## 0.19.8

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.8

## 0.19.7

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.7

## 0.19.6

### Patch Changes

- feat: add main-thread API: \_\_QuerySelector ([#2115](https://github.com/lynx-family/lynx-stack/pull/2115))

- fix: when a list-item is deleted from list, the deleted list-item is still showed incorrectly. ([#1092](https://github.com/lynx-family/lynx-stack/pull/1092))

  This is because the `enqueueComponent` method does not delete the node from the Element Tree. It is only to maintain the display node on RL, and lynx web needs to delete the dom additionally.

- feat: support main thread invoke ui method ([#2104](https://github.com/lynx-family/lynx-stack/pull/2104))

- fix: mts && bts events can be binded both ([#2121](https://github.com/lynx-family/lynx-stack/pull/2121))

- Updated dependencies [[`179f984`](https://github.com/lynx-family/lynx-stack/commit/179f9844adf00ff4b2cd450ffb943649441c87d3), [`f7133c1`](https://github.com/lynx-family/lynx-stack/commit/f7133c137f094063e991dfa0e993ea92177aa173), [`6c2b51a`](https://github.com/lynx-family/lynx-stack/commit/6c2b51a661ae244eb40671f63f29ee971e084ed4), [`5b589ab`](https://github.com/lynx-family/lynx-stack/commit/5b589ab53b01a8e2357d3ccbb159edab004086d3)]:
  - @lynx-js/web-constants@0.19.6

## 0.19.5

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.5

## 0.19.4

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.4

## 0.19.3

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.3

## 0.19.2

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.2

## 0.19.1

### Patch Changes

- fix: fix reload lynx-view when `enableCSSSelector` false may cause css style lost ([#1982](https://github.com/lynx-family/lynx-stack/pull/1982))

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.1

## 0.19.0

### Patch Changes

- fix: capture and bind event listener should be trigger correctly ([#1972](https://github.com/lynx-family/lynx-stack/pull/1972))

- fix: the l-p-comp-uid of page should be '1' ([#1970](https://github.com/lynx-family/lynx-stack/pull/1970))

- Updated dependencies []:
  - @lynx-js/web-constants@0.19.0

## 0.18.4

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.18.4

## 0.18.3

### Patch Changes

- fix: The `e.detail` in the `bindtap` callback needs to correctly include `x` and `y`. ([#1913](https://github.com/lynx-family/lynx-stack/pull/1913))

- Updated dependencies [[`ebc1a60`](https://github.com/lynx-family/lynx-stack/commit/ebc1a606318e9809e8a07457e18536b59be12a18)]:
  - @lynx-js/web-constants@0.18.3
  - @lynx-js/web-style-transformer@0.18.3

## 0.18.2

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.18.2
  - @lynx-js/web-style-transformer@0.18.2

## 0.18.1

### Patch Changes

- fix: mts freeze after reload() ([#1892](https://github.com/lynx-family/lynx-stack/pull/1892))

  The mts may be freezed after reload() called.

  We fixed it by waiting until the all-on-ui Javascript realm implementation, an iframe, to be fully loaded.

- Updated dependencies []:
  - @lynx-js/web-constants@0.18.1
  - @lynx-js/web-style-transformer@0.18.1

## 0.18.0

### Patch Changes

- fix: ([#1837](https://github.com/lynx-family/lynx-stack/pull/1837))

  1. `LynxView.updateData()` cannot trigger `dataProcessor`.

  2. **This is a break change:** The second parameter of `LynxView.updateData()` has been changed from `UpdateDataType` to `string`, which is the `processorName` (default is `default` which will use `defaultDataProcessor`). This change is to better align with Native. The current complete type is as follows:

  ```ts
  LynxView.updateData(data: Cloneable, processorName?: string | undefined, callback?: (() => void) | undefined): void
  ```

- feat: mouse event output structures remain aligned ([#1820](https://github.com/lynx-family/lynx-stack/pull/1820))

- Updated dependencies [[`77397fd`](https://github.com/lynx-family/lynx-stack/commit/77397fd535cf60556f8f82f7ef8dae8a623d1625)]:
  - @lynx-js/web-constants@0.18.0
  - @lynx-js/web-style-transformer@0.18.0

## 0.17.2

### Patch Changes

- Updated dependencies [[`a35a245`](https://github.com/lynx-family/lynx-stack/commit/a35a2452e5355bda3c475f9a750a86085e0cf56a)]:
  - @lynx-js/web-constants@0.17.2
  - @lynx-js/web-style-transformer@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.17.1
  - @lynx-js/web-style-transformer@0.17.1

## 0.17.0

### Patch Changes

- fix: \_\_QueryComponentImpl in mts should execute only once for same url ([#1763](https://github.com/lynx-family/lynx-stack/pull/1763))

- fix: avoid duplicate style transformation ([#1748](https://github.com/lynx-family/lynx-stack/pull/1748))

  After this commit, we use DAG methods to handle the styleInfos

- feat: support lazy bundle with CSSOG(`enableCSSSelector: false`). ([#1770](https://github.com/lynx-family/lynx-stack/pull/1770))

- Updated dependencies [[`93d707b`](https://github.com/lynx-family/lynx-stack/commit/93d707b82a59f7256952e21da6dcad2999f8233d)]:
  - @lynx-js/web-constants@0.17.0
  - @lynx-js/web-style-transformer@0.17.0

## 0.16.1

### Patch Changes

- feat: supports lazy bundle. (This feature requires `@lynx-js/lynx-core >= 0.1.3`) ([#1235](https://github.com/lynx-family/lynx-stack/pull/1235))

- Updated dependencies [[`608f375`](https://github.com/lynx-family/lynx-stack/commit/608f375e20732cc4c9f141bfbf9800ba6896100b)]:
  - @lynx-js/web-constants@0.16.1
  - @lynx-js/web-style-transformer@0.16.1

## 0.16.0

### Minor Changes

- refactor: provide the mts a real globalThis ([#1589](https://github.com/lynx-family/lynx-stack/pull/1589))

  Before this change, We create a function wrapper and a fake globalThis for Javascript code.

  This caused some issues.

  After this change, we will create an iframe for createing an isolated Javascript context.

  This means the globalThis will be the real one.

### Patch Changes

- refactor: add `:not([l-e-name])` at the end of selector for lazy component ([#1622](https://github.com/lynx-family/lynx-stack/pull/1622))

- fix: the SystemInfo in bts should be assigned to the globalThis ([#1599](https://github.com/lynx-family/lynx-stack/pull/1599))

- Updated dependencies [[`1a32dd8`](https://github.com/lynx-family/lynx-stack/commit/1a32dd886fe736c95639f67028cf7685377d9769), [`bb53d9a`](https://github.com/lynx-family/lynx-stack/commit/bb53d9a035f607e7c89952098d4ed77877a2e3c1), [`c1f8715`](https://github.com/lynx-family/lynx-stack/commit/c1f8715a81b2e69ff46fc363013626db4468c209)]:
  - @lynx-js/web-constants@0.16.0
  - @lynx-js/web-style-transformer@0.16.0

## 0.15.7

### Patch Changes

- fix: globalThis is never accessible in MTS ([#1531](https://github.com/lynx-family/lynx-stack/pull/1531))

- Updated dependencies [[`70863fb`](https://github.com/lynx-family/lynx-stack/commit/70863fbc311d8885ebda40855668097b0631f521)]:
  - @lynx-js/web-constants@0.15.7
  - @lynx-js/web-style-transformer@0.15.7

## 0.15.6

### Patch Changes

- fix: systeminfo in mts function ([#1537](https://github.com/lynx-family/lynx-stack/pull/1537))

- refactor: use utf-8 string ([#1473](https://github.com/lynx-family/lynx-stack/pull/1473))

- feat: add MTS API: \_\_UpdateComponentInfo ([#1485](https://github.com/lynx-family/lynx-stack/pull/1485))

- fix: \_\_ElementFromBinary should mark all elements actively ([#1484](https://github.com/lynx-family/lynx-stack/pull/1484))

- fix: `__ElementFromBinary` needs to correctly apply the dataset in elementTemplate to the Element ([#1487](https://github.com/lynx-family/lynx-stack/pull/1487))

- fix: all attributes except `id` and `type` under ElementTemplateData are optional. ([#1483](https://github.com/lynx-family/lynx-stack/pull/1483))

- feat: add MTS API \_\_GetAttributeByName ([#1486](https://github.com/lynx-family/lynx-stack/pull/1486))

- Updated dependencies [[`405a917`](https://github.com/lynx-family/lynx-stack/commit/405a9170442ae32603b7687549b49ab4b34aff92), [`b8f89e2`](https://github.com/lynx-family/lynx-stack/commit/b8f89e25f106a15ba9d70f2df06dfb684cbb6633), [`f76aae9`](https://github.com/lynx-family/lynx-stack/commit/f76aae9ea06abdc7022ba508d22f9f4eb00864e8), [`d8381a5`](https://github.com/lynx-family/lynx-stack/commit/d8381a58d12af6424cab4955617251e798bdc9f1), [`214898b`](https://github.com/lynx-family/lynx-stack/commit/214898bb9c74fc9b44e68cb220a4c02485102ce2), [`ab8cee4`](https://github.com/lynx-family/lynx-stack/commit/ab8cee4bab384fa905c045c4b4b93e5d4a95d57f)]:
  - @lynx-js/web-constants@0.15.6
  - @lynx-js/web-style-transformer@0.15.6

## 0.15.5

### Patch Changes

- fix: load main-thread chunk in ESM format ([#1437](https://github.com/lynx-family/lynx-stack/pull/1437))

  See [nodejs/node#59362](https://github.com/nodejs/node/issues/59362) for more details.

- Updated dependencies [[`29434ae`](https://github.com/lynx-family/lynx-stack/commit/29434aec853f14242f521316429cf07a93b8c371), [`fb7096b`](https://github.com/lynx-family/lynx-stack/commit/fb7096bb3c79166cd619a407095b8206eccb7918)]:
  - @lynx-js/web-constants@0.15.5
  - @lynx-js/web-style-transformer@0.15.5

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

- Updated dependencies [[`22ca433`](https://github.com/lynx-family/lynx-stack/commit/22ca433eb96b39724c6eb47ce0a938d291bbdef2)]:
  - @lynx-js/web-constants@0.15.4
  - @lynx-js/web-style-transformer@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [[`0da5ef0`](https://github.com/lynx-family/lynx-stack/commit/0da5ef03e41f20e9f8019c6dc03cb4a38ab18854)]:
  - @lynx-js/web-constants@0.15.3

## 0.15.2

### Patch Changes

- feat: support SSR for all-on-ui ([#1029](https://github.com/lynx-family/lynx-stack/pull/1029))

- feat: move SSR hydrate essential info to the ssr attribute ([#1292](https://github.com/lynx-family/lynx-stack/pull/1292))

  We found that in browser there is no simple tool to decode a base64 string

  Therefore we move the data to `ssr` attribute

  Also fix some ssr issues

- feat: support \_\_MarkTemplateElement, \_\_MarkPartElement and \_\_GetTemplateParts for all-on-ui ([#1275](https://github.com/lynx-family/lynx-stack/pull/1275))

- feat: mark template elements for SSR and update part ID handling ([#1286](https://github.com/lynx-family/lynx-stack/pull/1286))

- Updated dependencies [[`1443e46`](https://github.com/lynx-family/lynx-stack/commit/1443e468a353363e29aab0d90cd8b91c232a5525), [`5062128`](https://github.com/lynx-family/lynx-stack/commit/5062128c68e21abcf276ebcb40d7cc8f6e54244b)]:
  - @lynx-js/web-constants@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies [[`e59138b`](https://github.com/lynx-family/lynx-stack/commit/e59138b3c2285ce83a2927ee046671b9015acdfd)]:
  - @lynx-js/web-style-transformer@0.3.3
  - @lynx-js/web-constants@0.15.1

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

- Updated dependencies [[`16f402f`](https://github.com/lynx-family/lynx-stack/commit/16f402f557ba12ec34a35a1b9b00115bf576c20f), [`60095d7`](https://github.com/lynx-family/lynx-stack/commit/60095d741ae969e76a8faeb669a0fbe7e6e81f7c), [`224c653`](https://github.com/lynx-family/lynx-stack/commit/224c653f370d807281fa0a9ffbb4f4dd5c9d308e)]:
  - @lynx-js/web-style-transformer@0.3.2
  - @lynx-js/web-constants@0.15.0

## 0.14.2

### Patch Changes

- feat: merge multiple markTiming RPC communication events together and send them together, which can effectively reduce the number of RPC communications. ([#1178](https://github.com/lynx-family/lynx-stack/pull/1178))

- fix: correctly handle with CSS compound-selector, such as `.a.b`, which will be processed as `.a .b` incorrectly. ([#1187](https://github.com/lynx-family/lynx-stack/pull/1187))

  This problem also occurs when used in combination with other selectors, here are some ways to write styles that worked incorrectly before this commit:

  - `.a.b { }`
  - `.a.b view { }`
  - `.a.b:not(.c) { }`
  - `.a.b::placeholder { }`

- Updated dependencies [[`e44b146`](https://github.com/lynx-family/lynx-stack/commit/e44b146b1bc2b58c0347af7fb4e4157688e07e36), [`6ca5b91`](https://github.com/lynx-family/lynx-stack/commit/6ca5b9106aade393dfac88914b160960a61a82f2)]:
  - @lynx-js/web-constants@0.14.2

## 0.14.1

### Patch Changes

- fix: under the all-on-ui strategy, reload() will add two page elements. ([#1147](https://github.com/lynx-family/lynx-stack/pull/1147))

- Updated dependencies [[`a64333e`](https://github.com/lynx-family/lynx-stack/commit/a64333ef28228d6b90c32e027f67bef8acbd8432), [`7751375`](https://github.com/lynx-family/lynx-stack/commit/775137521782ca5445f22029c39163c0a63bbfa5), [`b52a924`](https://github.com/lynx-family/lynx-stack/commit/b52a924a2375cb6f7ebafdd8abfbab0254eb2330)]:
  - @lynx-js/web-constants@0.14.1

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

- feat: supports `lynx.getI18nResource()` and `onI18nResourceReady` event in bts. ([#1088](https://github.com/lynx-family/lynx-stack/pull/1088))

  - `lynx.getI18nResource()` can be used to get i18nResource in bts, it has two data sources:
    - the result of `_I18nResourceTranslation()`
    - lynx-view `updateI18nResources(data: InitI18nResources, options: I18nResourceTranslationOptions)`, it will be matched to the correct i8nResource as a result of `lynx.getI18nResource()`
  - `onI18nResourceReady` event can be used to listen `_I18nResourceTranslation` and lynx-view `updateI18nResources` execution.

- feat: add `updateI18nResources` method of lynx-view. ([#1085](https://github.com/lynx-family/lynx-stack/pull/1085))

  Now you can use `updateI18nResources` to update i18nResources, and then use \_I18nResourceTranslation() to get the updated result.

- fix: `decodeCssInJs` will not throw error. ([#1120](https://github.com/lynx-family/lynx-stack/pull/1120))

  Before this pr, decoding css will be strictly executed according to cssInfo, and an error will be thrown if data that does not meet the requirements is encountered. Now it is changed to console.warn, which will not block rendering.

- Updated dependencies [[`25a04c9`](https://github.com/lynx-family/lynx-stack/commit/25a04c9e59f4b893227bdead74f2de69f6615cdb), [`0dbb8b1`](https://github.com/lynx-family/lynx-stack/commit/0dbb8b1f580d0700e2b67b92018a7a00d1494837), [`f99de1e`](https://github.com/lynx-family/lynx-stack/commit/f99de1ef60cc5a11eae4fd0acc70a490787d36c9), [`873a285`](https://github.com/lynx-family/lynx-stack/commit/873a2852fa3df9e32c48a6504160bb243540c7b9), [`afacb2c`](https://github.com/lynx-family/lynx-stack/commit/afacb2cbea7feca46c553651000625d0845b2b00), [`7e73450`](https://github.com/lynx-family/lynx-stack/commit/7e73450f8f5f1153f8a064036f5552c1335c23d7)]:
  - @lynx-js/web-constants@0.14.0
  - @lynx-js/web-style-transformer@0.3.1

## 0.13.5

### Patch Changes

- refactor: move some internal status to dom's attribute ([#945](https://github.com/lynx-family/lynx-stack/pull/945))

  It's essential for SSR

- refactor: avoid to create many style element for cssog ([#1026](https://github.com/lynx-family/lynx-stack/pull/1026))

- fix: target.id is undefined ([#1016](https://github.com/lynx-family/lynx-stack/pull/1016))

- feat: add new pageConfig configuration: enableJSDataProcessor ([#886](https://github.com/lynx-family/lynx-stack/pull/886))

- refactor: move component config info to attribute ([#984](https://github.com/lynx-family/lynx-stack/pull/984))

- refactor: save dataset on an attribute ([#981](https://github.com/lynx-family/lynx-stack/pull/981))

  On lynx, the `data-*` attributes have different behaviors than the HTMLElement has.

  The dataset will be treated as properties, the key will not be applied the camel-case <-> hyphenate name transformation.

  Before this commit we use it as a runtime data, but after this commit we will use encodeURI(JSON.stringify(dataset)) to encode it as a string.

- refactor: create elements of `elementToRuntimeInfoMap` on demand ([#986](https://github.com/lynx-family/lynx-stack/pull/986))

- refactor: implement mts apis in closure pattern ([#1004](https://github.com/lynx-family/lynx-stack/pull/1004))

- Updated dependencies [[`70b82d2`](https://github.com/lynx-family/lynx-stack/commit/70b82d23744d6b6ec945dff9f8895ab3488ba4c8), [`9499ea9`](https://github.com/lynx-family/lynx-stack/commit/9499ea91debdf73b2d31af0b31bcbc216135543b), [`50f0193`](https://github.com/lynx-family/lynx-stack/commit/50f01933942268b697bf5abe790da86c932f1dfc), [`57bf0ef`](https://github.com/lynx-family/lynx-stack/commit/57bf0ef19f1d79bc52ab6a4f0cd2939e7901d98b), [`0525fbf`](https://github.com/lynx-family/lynx-stack/commit/0525fbf38baa7a977a7a8c66e8a4d8bf34cc3b68), [`b6b87fd`](https://github.com/lynx-family/lynx-stack/commit/b6b87fd11dbc76c28f3b5022aa8c6afeb773d90f), [`c014327`](https://github.com/lynx-family/lynx-stack/commit/c014327ad0cf599b32d4182d95116b46c35f5fa5)]:
  - @lynx-js/web-constants@0.13.5

## 0.13.4

### Patch Changes

- fix: style loss issue caused by incorrect handling of styleInfo-imports when enableCSSSelector and enableRemoveCSSScope are turned off. ([#931](https://github.com/lynx-family/lynx-stack/pull/931))

- Updated dependencies [[`569618d`](https://github.com/lynx-family/lynx-stack/commit/569618d8e2665f5c9e1672f7ee5900ec2a5179a2), [`f9f88d6`](https://github.com/lynx-family/lynx-stack/commit/f9f88d6fb9c42d3370a6622d9d799d671ffcf1a7)]:
  - @lynx-js/web-constants@0.13.4

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

- Updated dependencies [[`b6e27da`](https://github.com/lynx-family/lynx-stack/commit/b6e27daf865b0627b1c3238228a4fdf65ad87ee3)]:
  - @lynx-js/web-constants@0.13.3

## 0.13.2

### Patch Changes

- feat: allow lynx code to get JS engine provided properties on globalThis ([#786](https://github.com/lynx-family/lynx-stack/pull/786))

  ```
  globalThis.Reflect; // this will be the Reflect Object
  ```

  Note that `assigning to the globalThis` is still not allowed.

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- Updated dependencies [[`8cdd288`](https://github.com/lynx-family/lynx-stack/commit/8cdd28884288b9456aee3a919d6edbf72da1c67b)]:
  - @lynx-js/web-constants@0.13.2

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

- Updated dependencies [[`c9ccad6`](https://github.com/lynx-family/lynx-stack/commit/c9ccad6b574c98121149d3e9d4a9a7e97af63d91)]:
  - @lynx-js/web-constants@0.13.1

## 0.13.0

### Minor Changes

- fix: mts lynx will no longer provide requireModule, requireModuleAsync methods, which is aligned with Native. ([#537](https://github.com/lynx-family/lynx-stack/pull/537))

### Patch Changes

- refactor: isolate SystemInfo ([#628](https://github.com/lynx-family/lynx-stack/pull/628))

  Never assign `SystemInfo` on worker's self object.

- feat: support thread strategy `all-on-ui` ([#625](https://github.com/lynx-family/lynx-stack/pull/625))

  ```html
  <lynx-view thread-strategy="all-on-ui"></lynx-view>
  ```

  This will make the lynx's main-thread run on the UA's main thread.

  Note that the `all-on-ui` does not support the HMR & chunk splitting yet.

- fix(web): `:root` not work on web platform ([#607](https://github.com/lynx-family/lynx-stack/pull/607))

  Note: To solve this issue, you need to upgrade your `react-rsbuild-plugin`

- refactor: move mainthread impl into mainthread-api packages ([#622](https://github.com/lynx-family/lynx-stack/pull/622))

- fix(web): css selector not work for selectors with combinator and pseudo-class on WEB ([#608](https://github.com/lynx-family/lynx-stack/pull/608))

  like `.parent > :not([hidden]) ~ :not([hidden])`

  you will need to upgrade your `react-rsbuild-plugin` to fix this issue

- Updated dependencies [[`4ee0465`](https://github.com/lynx-family/lynx-stack/commit/4ee0465f6e5846a0d038b49d2a7c95e87c9e5c77), [`5a3d9af`](https://github.com/lynx-family/lynx-stack/commit/5a3d9afe52ba639987db124ca35580261e0718b5), [`5269cab`](https://github.com/lynx-family/lynx-stack/commit/5269cabef7609159bdd0dd14a03c5da667907424)]:
  - @lynx-js/web-constants@0.13.0

## 0.12.0

### Patch Changes

- feat: fully support MTS ([#569](https://github.com/lynx-family/lynx-stack/pull/569))

  Now use support the following usage

  - mainthread event
  - mainthread ref
  - runOnMainThread/runOnBackground
  - ref.current.xx

- feat: support mts event with target methods ([#564](https://github.com/lynx-family/lynx-stack/pull/564))

  After this commit, developers are allowed to invoke `event.target.setStyleProperty` in mts handler

- fix: crash on removing a id attribute ([#582](https://github.com/lynx-family/lynx-stack/pull/582))

- Updated dependencies [[`f1ca29b`](https://github.com/lynx-family/lynx-stack/commit/f1ca29bd766377dd46583f15e1e75bca447699cd), [`7edf478`](https://github.com/lynx-family/lynx-stack/commit/7edf478410cb57eeedc18aac6f5d3950b16c7fa8)]:
  - @lynx-js/web-constants@0.12.0
  - @lynx-js/web-style-transformer@0.3.0

## 0.11.0

### Patch Changes

- feat: support mts event handler (1/n) ([#495](https://github.com/lynx-family/lynx-stack/pull/495))

  now the main-thread:bind handler could be invoked. The params of the handler will be implemented later.

- Updated dependencies [[`ea42e62`](https://github.com/lynx-family/lynx-stack/commit/ea42e62fbcd5c743132c3e6e7c4851770742d544), [`a0f5ca4`](https://github.com/lynx-family/lynx-stack/commit/a0f5ca4ea0895ccbaa6aa63f449f53a677a1cf73)]:
  - @lynx-js/web-constants@0.11.0

## 0.10.1

### Patch Changes

- Updated dependencies [[`1af3b60`](https://github.com/lynx-family/lynx-stack/commit/1af3b6052ab27f98bf0e4d1b0ec9f7d9e88e0afc)]:
  - @lynx-js/web-constants@0.10.1

## 0.10.0

### Minor Changes

- feat: rewrite the main thread Element PAPIs ([#343](https://github.com/lynx-family/lynx-stack/pull/343))

  In this commit we've rewritten the main thread apis.

  The most highlighted change is that

  - Before this commit we send events directly to bts
  - After this change, we send events to mts then send them to bts with some data combined.

### Patch Changes

- feat(web): use pure DOM API to implement Element PAPIs ([#334](https://github.com/lynx-family/lynx-stack/pull/334))

  1. rewrite all element PAPIs impl. Now we use DOM.
  2. use our new package `@lynx-js/offscreen-document` to support the new Element PAPI implementation in a worker

- fix: inline style will be removed for value number `0` ([#368](https://github.com/lynx-family/lynx-stack/pull/368))

  the inline style value could be incorrectly removed for number value `0`;

  For example, `flex-shrink:0` may be ignored.

- fix: publicComponentEvent args order ([#401](https://github.com/lynx-family/lynx-stack/pull/401))

- Updated dependencies [[`3a8dabd`](https://github.com/lynx-family/lynx-stack/commit/3a8dabd877084c15db1404c912dd8a19c7a0fc59), [`a521759`](https://github.com/lynx-family/lynx-stack/commit/a5217592f5aebea4b17860e729d523ecabb5f691), [`890c6c5`](https://github.com/lynx-family/lynx-stack/commit/890c6c51470c82104abb1049681f55e5d97cf9d6)]:
  - @lynx-js/web-constants@0.10.0

## 0.9.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.9.1

## 0.9.0

### Minor Changes

- refractor: remove entryId concept ([#217](https://github.com/lynx-family/lynx-stack/pull/217))

  After the PR #198
  All contents are isolated by a shadowroot.
  Therefore we don't need to add the entryId selector to avoid the lynx-view's style taking effect on the whole page.

### Patch Changes

- refactor: clean the decodeOperations implementation ([#261](https://github.com/lynx-family/lynx-stack/pull/261))

- refactor: remove customelement defined detecting logic ([#247](https://github.com/lynx-family/lynx-stack/pull/247))

  Before this commit, for those element with tag without `-`, we always try to detect if the `x-${tagName}` is defined.

  After this commit, we pre-define a map(could be override by the `overrideLynxTagToHTMLTagMap`) to make that transformation for tag name.

  This change is a path to SSR and the MTS support.

- Updated dependencies [[`5b5e090`](https://github.com/lynx-family/lynx-stack/commit/5b5e090fdf0e896f1c38a49bf3ed9889117c4fb8), [`f447811`](https://github.com/lynx-family/lynx-stack/commit/f4478112a08d3cf2d1483b87d591ea4e3b6cc2ea), [`b844e75`](https://github.com/lynx-family/lynx-stack/commit/b844e751f566d924256365d37aec4c86c520ec00), [`6f16827`](https://github.com/lynx-family/lynx-stack/commit/6f16827d1f4d7364870d354fc805a8868c110f1e), [`d2d55ef`](https://github.com/lynx-family/lynx-stack/commit/d2d55ef9fe438c35921d9db0daa40d5228822ecc)]:
  - @lynx-js/web-constants@0.9.0
  - @lynx-js/web-style-transformer@0.2.3

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

### Patch Changes

- Updated dependencies [[`e9e8370`](https://github.com/lynx-family/lynx-stack/commit/e9e8370e070a50cbf65a4ebc46c2e37ea1e0be40), [`ec4e1ce`](https://github.com/lynx-family/lynx-stack/commit/ec4e1ce0d7612d6c0701792a46c78cd52130bad4), [`f0a717c`](https://github.com/lynx-family/lynx-stack/commit/f0a717c630700e16ab0af7f1fe370fd60ac75b30)]:
  - @lynx-js/web-constants@0.8.0

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

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb), [`2044571`](https://github.com/lynx-family/lynx-stack/commit/204457166531dae6e9f653db56b14187553b7666), [`399a6d9`](https://github.com/lynx-family/lynx-stack/commit/399a6d973024aa8a46ab2f2f13e7c82214066f9e), [`7da7601`](https://github.com/lynx-family/lynx-stack/commit/7da7601f00407970c485046ad73eeb8534aaa4f6)]:
  - @lynx-js/web-style-transformer@0.2.2
  - @lynx-js/web-constants@0.7.1

## 0.7.0

### Patch Changes

- Updated dependencies [1abf8f0]
  - @lynx-js/web-constants@0.7.0

## 0.6.2

### Patch Changes

- Updated dependencies [0412db0]
- Updated dependencies [085b99e]
- Updated dependencies [2738fdc]
  - @lynx-js/web-constants@0.6.2
  - @lynx-js/web-style-transformer@0.2.1

## 0.6.1

### Patch Changes

- 62b7841: feat: add lynx.requireModule in main-thread && \_\_LoadLepusChunk API.

  now the `lynx.requireModule` is available in mts.

- Updated dependencies [62b7841]
  - @lynx-js/web-constants@0.6.1

## 0.6.0

### Minor Changes

- e406d69: refractor: update output json format

  **This is a breaking change**

  Before this change the style info is dump in Javascript code.

  After this change the style info will be pure JSON data.

  Now we're using the css-serializer tool's output only. If you're using plugins for it, now they're enabled.

### Patch Changes

- Updated dependencies [e406d69]
  - @lynx-js/web-style-transformer@0.2.0
  - @lynx-js/web-constants@0.6.0

## 0.5.1

### Patch Changes

- b5ef20e: feat: updateData should also call `updatePage` in main-thread.
- Updated dependencies [c49b1fb]
- Updated dependencies [b5ef20e]
  - @lynx-js/web-constants@0.5.1

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

- Updated dependencies [3050faf]
- Updated dependencies [7b84edf]
  - @lynx-js/web-constants@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [168b4fa]
  - @lynx-js/web-constants@0.4.2

## 0.4.1

### Patch Changes

- 27c0e6e: feat(web): infer the cssId if parent component unique id is set

  ```
  (The following info is provided for DSL maintainers)

  - the 'infer' operation only happens on fiber element creating, changing the parent's cssId, changing children's parent component unique id will cause an issue
  - __SetCSSId will be called for setting inferred cssId value. Runtime could use the same `__SetCSSId` to overwrite this value.
  - cssId: `0` will be treated as an void value
  ```

- 500057e: fix: `__GetElementUniqueID` return -1 for illegal param

  (Only DSL developers need to care this)

  - @lynx-js/web-constants@0.4.1

## 0.4.0

### Patch Changes

- @lynx-js/web-constants@0.4.0

## 0.3.1

### Patch Changes

- @lynx-js/web-constants@0.3.1

## 0.3.0

### Patch Changes

- d255d24: fix: add attribute.style of ElementThreadElement, before it is always null.
- 6e873bc: fix: incorrect parent component id value on publishComponentEvent
- Updated dependencies [6e873bc]
- Updated dependencies [267c935]
  - @lynx-js/web-constants@0.3.0

## 0.2.0

### Patch Changes

- @lynx-js/web-constants@0.2.0

## 0.1.0

### Minor Changes

- 2973ba5: feat: move lynx main-thread to web worker

  Move The Mainthread of Lynx to a web worker.

  This helps the performance.

- f900b75: refactor: do not use inline style to apply css-in-js styles

  Now you will see your css-in-js styles applied under a `[lynx-unique-id="<id>"]` selector.

- c04669b: feat: migrate to new TemplatePlugin hooks

### Patch Changes

- e170052: fix: \_\_ReplaceElements may crash if the newChild is not an array
- Updated dependencies [2973ba5]
- Updated dependencies [f28650f]
- Updated dependencies [39cf3ae]
- Updated dependencies [6e003e8]
  - @lynx-js/web-constants@0.1.0
  - @lynx-js/web-style-transformer@0.1.0
