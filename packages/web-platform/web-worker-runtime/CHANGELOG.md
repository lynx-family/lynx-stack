# @lynx-js/web-worker-runtime

## 0.17.2

### Patch Changes

- feat: support load bts chunk from remote address ([#1834](https://github.com/lynx-family/lynx-stack/pull/1834))

  - re-support chunk splitting
  - support lynx.requireModule with a json file
  - support lynx.requireModule, lynx.requireModuleAsync with a remote url
  - support to add a breakpoint in chrome after reloading the web page

- Updated dependencies [[`a35a245`](https://github.com/lynx-family/lynx-stack/commit/a35a2452e5355bda3c475f9a750a86085e0cf56a)]:
  - @lynx-js/web-constants@0.17.2
  - @lynx-js/web-mainthread-apis@0.17.2
  - @lynx-js/web-worker-rpc@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.17.1
  - @lynx-js/web-mainthread-apis@0.17.1
  - @lynx-js/web-worker-rpc@0.17.1

## 0.17.0

### Patch Changes

- Updated dependencies [[`721635d`](https://github.com/lynx-family/lynx-stack/commit/721635de6c1d2d617c7cbaa86e7d816c42d62930), [`93d707b`](https://github.com/lynx-family/lynx-stack/commit/93d707b82a59f7256952e21da6dcad2999f8233d), [`d150ed4`](https://github.com/lynx-family/lynx-stack/commit/d150ed440a4f1e9d9a3a2911adf6e6fa39a0c589)]:
  - @lynx-js/web-mainthread-apis@0.17.0
  - @lynx-js/web-constants@0.17.0
  - @lynx-js/web-worker-rpc@0.17.0

## 0.16.1

### Patch Changes

- feat: supports lazy bundle. (This feature requires `@lynx-js/lynx-core >= 0.1.3`) ([#1235](https://github.com/lynx-family/lynx-stack/pull/1235))

- Updated dependencies [[`608f375`](https://github.com/lynx-family/lynx-stack/commit/608f375e20732cc4c9f141bfbf9800ba6896100b)]:
  - @lynx-js/web-mainthread-apis@0.16.1
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

- fix: the SystemInfo in bts should be assigned to the globalThis ([#1599](https://github.com/lynx-family/lynx-stack/pull/1599))

- Updated dependencies [[`1a32dd8`](https://github.com/lynx-family/lynx-stack/commit/1a32dd886fe736c95639f67028cf7685377d9769), [`bb53d9a`](https://github.com/lynx-family/lynx-stack/commit/bb53d9a035f607e7c89952098d4ed77877a2e3c1), [`1a32dd8`](https://github.com/lynx-family/lynx-stack/commit/1a32dd886fe736c95639f67028cf7685377d9769), [`c1f8715`](https://github.com/lynx-family/lynx-stack/commit/c1f8715a81b2e69ff46fc363013626db4468c209)]:
  - @lynx-js/web-mainthread-apis@0.16.0
  - @lynx-js/web-constants@0.16.0
  - @lynx-js/offscreen-document@0.1.4
  - @lynx-js/web-worker-rpc@0.16.0

## 0.15.7

### Patch Changes

- fix: globalThis is never accessible in MTS ([#1531](https://github.com/lynx-family/lynx-stack/pull/1531))

- Updated dependencies [[`70863fb`](https://github.com/lynx-family/lynx-stack/commit/70863fbc311d8885ebda40855668097b0631f521)]:
  - @lynx-js/web-mainthread-apis@0.15.7
  - @lynx-js/web-constants@0.15.7
  - @lynx-js/web-worker-rpc@0.15.7

## 0.15.6

### Patch Changes

- Updated dependencies [[`405a917`](https://github.com/lynx-family/lynx-stack/commit/405a9170442ae32603b7687549b49ab4b34aff92), [`b8f89e2`](https://github.com/lynx-family/lynx-stack/commit/b8f89e25f106a15ba9d70f2df06dfb684cbb6633), [`f76aae9`](https://github.com/lynx-family/lynx-stack/commit/f76aae9ea06abdc7022ba508d22f9f4eb00864e8), [`b8b060b`](https://github.com/lynx-family/lynx-stack/commit/b8b060b9bef722bb47bd90c33fab3922160c711d), [`d8381a5`](https://github.com/lynx-family/lynx-stack/commit/d8381a58d12af6424cab4955617251e798bdc9f1), [`214898b`](https://github.com/lynx-family/lynx-stack/commit/214898bb9c74fc9b44e68cb220a4c02485102ce2), [`ab8cee4`](https://github.com/lynx-family/lynx-stack/commit/ab8cee4bab384fa905c045c4b4b93e5d4a95d57f)]:
  - @lynx-js/web-mainthread-apis@0.15.6
  - @lynx-js/web-constants@0.15.6
  - @lynx-js/web-worker-rpc@0.15.6

## 0.15.5

### Patch Changes

- feat: support path() for `createQuerySelector` ([#1456](https://github.com/lynx-family/lynx-stack/pull/1456))

  - Added `getPathInfo` API to `NativeApp` and its cross-thread handler for retrieving the path from a DOM node to the root.
  - Implemented endpoint and handler registration in both background and UI threads.
  - Implemented `nativeApp.getPathInfo()`

- Updated dependencies [[`29434ae`](https://github.com/lynx-family/lynx-stack/commit/29434aec853f14242f521316429cf07a93b8c371), [`fb7096b`](https://github.com/lynx-family/lynx-stack/commit/fb7096bb3c79166cd619a407095b8206eccb7918)]:
  - @lynx-js/web-mainthread-apis@0.15.5
  - @lynx-js/web-constants@0.15.5
  - @lynx-js/web-worker-rpc@0.15.5

## 0.15.4

### Patch Changes

- optimize IO for all-on-ui: make startMainThreadWorker async and defer import ([#1385](https://github.com/lynx-family/lynx-stack/pull/1385))

- Updated dependencies [[`22ca433`](https://github.com/lynx-family/lynx-stack/commit/22ca433eb96b39724c6eb47ce0a938d291bbdef2), [`143e481`](https://github.com/lynx-family/lynx-stack/commit/143e481b4353b3c3d2e8d9cc4f201442ca56f097)]:
  - @lynx-js/web-mainthread-apis@0.15.4
  - @lynx-js/web-constants@0.15.4
  - @lynx-js/web-worker-rpc@0.15.4

## 0.15.3

### Patch Changes

- Updated dependencies [[`0da5ef0`](https://github.com/lynx-family/lynx-stack/commit/0da5ef03e41f20e9f8019c6dc03cb4a38ab18854)]:
  - @lynx-js/web-constants@0.15.3
  - @lynx-js/web-mainthread-apis@0.15.3
  - @lynx-js/web-worker-rpc@0.15.3

## 0.15.2

### Patch Changes

- Updated dependencies [[`cebda59`](https://github.com/lynx-family/lynx-stack/commit/cebda592ac5c7d152c877c2ac5ec403d477077e1), [`1443e46`](https://github.com/lynx-family/lynx-stack/commit/1443e468a353363e29aab0d90cd8b91c232a5525), [`5062128`](https://github.com/lynx-family/lynx-stack/commit/5062128c68e21abcf276ebcb40d7cc8f6e54244b), [`f656b7f`](https://github.com/lynx-family/lynx-stack/commit/f656b7f0d390d69c0da0d11a6c9b3f66ae877ac8)]:
  - @lynx-js/web-mainthread-apis@0.15.2
  - @lynx-js/web-constants@0.15.2
  - @lynx-js/web-worker-rpc@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-mainthread-apis@0.15.1
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

- feat: add `napiModulesPath` to bundle napiModules into worker runtime. ([#1134](https://github.com/lynx-family/lynx-stack/pull/1134))

  Usage:

  ```ts
  import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
  import { defineConfig } from '@rsbuild/core';

  export default defineConfig({
    plugins: [
      pluginWebPlatform({
        // replace with your actual napi-modules file path
        napiModulesPath: path.resolve(__dirname, './index.napi-modules.ts'),
      }),
    ],
  });
  ```

  `napi-modules.ts` example:

  ```ts
  // index.napi-modules.ts
  export default {
    custom_module: function(NapiModules, NapiModulesCall) {
      return {
        async test(name) {
          console.log('CustomModule', NapiModules, NapiModulesCall);
        },
      };
    },
  };
  ```

- Updated dependencies [[`7b75469`](https://github.com/lynx-family/lynx-stack/commit/7b75469d05dd2ec78bf6e1e54b94c8dff938eb40), [`224c653`](https://github.com/lynx-family/lynx-stack/commit/224c653f370d807281fa0a9ffbb4f4dd5c9d308e)]:
  - @lynx-js/offscreen-document@0.1.3
  - @lynx-js/web-mainthread-apis@0.15.0
  - @lynx-js/web-constants@0.15.0
  - @lynx-js/web-worker-rpc@0.15.0

## 0.14.2

### Patch Changes

- feat: merge multiple markTiming RPC communication events together and send them together, which can effectively reduce the number of RPC communications. ([#1178](https://github.com/lynx-family/lynx-stack/pull/1178))

- Updated dependencies [[`e44b146`](https://github.com/lynx-family/lynx-stack/commit/e44b146b1bc2b58c0347af7fb4e4157688e07e36), [`5a9b38b`](https://github.com/lynx-family/lynx-stack/commit/5a9b38b783e611aa9761c4cd52191172270c09c7), [`6ca5b91`](https://github.com/lynx-family/lynx-stack/commit/6ca5b9106aade393dfac88914b160960a61a82f2)]:
  - @lynx-js/web-mainthread-apis@0.14.2
  - @lynx-js/web-constants@0.14.2
  - @lynx-js/web-worker-rpc@0.14.2

## 0.14.1

### Patch Changes

- feat: support BTS API `lynx.reportError` && `__SetSourceMapRelease`, now you can use it and handle it in lynx-view error event. ([#1059](https://github.com/lynx-family/lynx-stack/pull/1059))

- Updated dependencies [[`a64333e`](https://github.com/lynx-family/lynx-stack/commit/a64333ef28228d6b90c32e027f67bef8acbd8432), [`7751375`](https://github.com/lynx-family/lynx-stack/commit/775137521782ca5445f22029c39163c0a63bbfa5), [`b52a924`](https://github.com/lynx-family/lynx-stack/commit/b52a924a2375cb6f7ebafdd8abfbab0254eb2330)]:
  - @lynx-js/web-constants@0.14.1
  - @lynx-js/web-mainthread-apis@0.14.1
  - @lynx-js/web-worker-rpc@0.14.1

## 0.14.0

### Patch Changes

- fix: The parameter config of loadCard needs to add updateData, otherwise some event binding will fail when enableJSDataProcessor is turned on. ([#1077](https://github.com/lynx-family/lynx-stack/pull/1077))

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

- Updated dependencies [[`25a04c9`](https://github.com/lynx-family/lynx-stack/commit/25a04c9e59f4b893227bdead74f2de69f6615cdb), [`0dbb8b1`](https://github.com/lynx-family/lynx-stack/commit/0dbb8b1f580d0700e2b67b92018a7a00d1494837), [`f99de1e`](https://github.com/lynx-family/lynx-stack/commit/f99de1ef60cc5a11eae4fd0acc70a490787d36c9), [`873a285`](https://github.com/lynx-family/lynx-stack/commit/873a2852fa3df9e32c48a6504160bb243540c7b9), [`afacb2c`](https://github.com/lynx-family/lynx-stack/commit/afacb2cbea7feca46c553651000625d0845b2b00), [`1861cbe`](https://github.com/lynx-family/lynx-stack/commit/1861cbead4b373e0511214999b0e100b6285fa9a)]:
  - @lynx-js/web-mainthread-apis@0.14.0
  - @lynx-js/web-constants@0.14.0
  - @lynx-js/offscreen-document@0.1.2
  - @lynx-js/web-worker-rpc@0.14.0

## 0.13.5

### Patch Changes

- refactor: implement mts apis in closure pattern ([#1004](https://github.com/lynx-family/lynx-stack/pull/1004))

- Updated dependencies [[`70b82d2`](https://github.com/lynx-family/lynx-stack/commit/70b82d23744d6b6ec945dff9f8895ab3488ba4c8), [`5651e24`](https://github.com/lynx-family/lynx-stack/commit/5651e24827358963c3261252bcc53c2ad981c13e), [`9499ea9`](https://github.com/lynx-family/lynx-stack/commit/9499ea91debdf73b2d31af0b31bcbc216135543b), [`50f0193`](https://github.com/lynx-family/lynx-stack/commit/50f01933942268b697bf5abe790da86c932f1dfc), [`57bf0ef`](https://github.com/lynx-family/lynx-stack/commit/57bf0ef19f1d79bc52ab6a4f0cd2939e7901d98b), [`5651e24`](https://github.com/lynx-family/lynx-stack/commit/5651e24827358963c3261252bcc53c2ad981c13e), [`0525fbf`](https://github.com/lynx-family/lynx-stack/commit/0525fbf38baa7a977a7a8c66e8a4d8bf34cc3b68), [`b6b87fd`](https://github.com/lynx-family/lynx-stack/commit/b6b87fd11dbc76c28f3b5022aa8c6afeb773d90f), [`c014327`](https://github.com/lynx-family/lynx-stack/commit/c014327ad0cf599b32d4182d95116b46c35f5fa5)]:
  - @lynx-js/web-mainthread-apis@0.13.5
  - @lynx-js/web-constants@0.13.5
  - @lynx-js/offscreen-document@0.1.1
  - @lynx-js/web-worker-rpc@0.13.5

## 0.13.4

### Patch Changes

- feat: lynx-view supports `updateGlobalProps` method, which can be used to update lynx.\_\_globalProps ([#918](https://github.com/lynx-family/lynx-stack/pull/918))

- feat: supports `lynx.getElementById()` && `animate()`. ([#912](https://github.com/lynx-family/lynx-stack/pull/912))

  After this commit, you can use `lynx.getElementById()` to get the element by id, and use `element.animate()` to animate the element.

- Updated dependencies [[`96d3133`](https://github.com/lynx-family/lynx-stack/commit/96d3133b149b61af01c5478f4dc7b0a071137d98), [`75e5b2f`](https://github.com/lynx-family/lynx-stack/commit/75e5b2ff16ecf5f7072a45cd130e653dee747461), [`569618d`](https://github.com/lynx-family/lynx-stack/commit/569618d8e2665f5c9e1672f7ee5900ec2a5179a2), [`f9f88d6`](https://github.com/lynx-family/lynx-stack/commit/f9f88d6fb9c42d3370a6622d9d799d671ffcf1a7)]:
  - @lynx-js/web-mainthread-apis@0.13.4
  - @lynx-js/offscreen-document@0.1.0
  - @lynx-js/web-constants@0.13.4
  - @lynx-js/web-worker-rpc@0.13.4

## 0.13.3

### Patch Changes

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- Updated dependencies [[`bb1f9d8`](https://github.com/lynx-family/lynx-stack/commit/bb1f9d845ef2395a0508666701409972e159389d), [`b6e27da`](https://github.com/lynx-family/lynx-stack/commit/b6e27daf865b0627b1c3238228a4fdf65ad87ee3), [`3d716d7`](https://github.com/lynx-family/lynx-stack/commit/3d716d79ae053b225e9bac2bbb036c968f5261e7)]:
  - @lynx-js/offscreen-document@0.0.4
  - @lynx-js/web-mainthread-apis@0.13.3
  - @lynx-js/web-constants@0.13.3
  - @lynx-js/web-worker-rpc@0.13.3

## 0.13.2

### Patch Changes

- feat: allow lynx code to get JS engine provided properties on globalThis ([#786](https://github.com/lynx-family/lynx-stack/pull/786))

  ```
  globalThis.Reflect; // this will be the Reflect Object
  ```

  Note that `assigning to the globalThis` is still not allowed.

- feat: return the offscreenDocument instance for startMainThread() ([#772](https://github.com/lynx-family/lynx-stack/pull/772))

- Updated dependencies [[`03a5f64`](https://github.com/lynx-family/lynx-stack/commit/03a5f64d7d09e38903f5d1c022f36f6e68b6432d), [`8cdd288`](https://github.com/lynx-family/lynx-stack/commit/8cdd28884288b9456aee3a919d6edbf72da1c67b), [`6d3d852`](https://github.com/lynx-family/lynx-stack/commit/6d3d8529d0d528419920102ca52da279bbe0f1e0)]:
  - @lynx-js/web-mainthread-apis@0.13.2
  - @lynx-js/web-constants@0.13.2
  - @lynx-js/offscreen-document@0.0.3
  - @lynx-js/web-worker-rpc@0.13.2

## 0.13.1

### Patch Changes

- feat: support for using `lynx.queueMicrotask`. ([#702](https://github.com/lynx-family/lynx-stack/pull/702))

- feat: support touch events for MTS ([#641](https://github.com/lynx-family/lynx-stack/pull/641))

  now we support

  - main-thread:bindtouchstart
  - main-thread:bindtouchend
  - main-thread:bindtouchmove
  - main-thread:bindtouchcancel

- feat: provide comments for `@lynx-js/web-platform-rsbuild-plugin`. ([#668](https://github.com/lynx-family/lynx-stack/pull/668))

- Updated dependencies [[`c9ccad6`](https://github.com/lynx-family/lynx-stack/commit/c9ccad6b574c98121149d3e9d4a9a7e97af63d91), [`9ad394e`](https://github.com/lynx-family/lynx-stack/commit/9ad394ea9ef28688a3b810b4051868b2a28eb7de), [`c9ccad6`](https://github.com/lynx-family/lynx-stack/commit/c9ccad6b574c98121149d3e9d4a9a7e97af63d91)]:
  - @lynx-js/offscreen-document@0.0.2
  - @lynx-js/web-mainthread-apis@0.13.1
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

- refactor: move mainthread impl into mainthread-api packages ([#622](https://github.com/lynx-family/lynx-stack/pull/622))

- Updated dependencies [[`4ee0465`](https://github.com/lynx-family/lynx-stack/commit/4ee0465f6e5846a0d038b49d2a7c95e87c9e5c77), [`74b5bd1`](https://github.com/lynx-family/lynx-stack/commit/74b5bd15339b70107a7c42525494da46e8f8f6bd), [`06bb78a`](https://github.com/lynx-family/lynx-stack/commit/06bb78a6b93d4a7be7177a6269dd4337852ce90d), [`5a3d9af`](https://github.com/lynx-family/lynx-stack/commit/5a3d9afe52ba639987db124ca35580261e0718b5), [`5269cab`](https://github.com/lynx-family/lynx-stack/commit/5269cabef7609159bdd0dd14a03c5da667907424), [`74b5bd1`](https://github.com/lynx-family/lynx-stack/commit/74b5bd15339b70107a7c42525494da46e8f8f6bd), [`2b069f8`](https://github.com/lynx-family/lynx-stack/commit/2b069f8786c95bdb9ac1f35091f05f7fd3b52225)]:
  - @lynx-js/web-mainthread-apis@0.13.0
  - @lynx-js/web-constants@0.13.0
  - @lynx-js/offscreen-document@0.0.1
  - @lynx-js/web-worker-rpc@0.13.0

## 0.12.0

### Patch Changes

- feat: fully support MTS ([#569](https://github.com/lynx-family/lynx-stack/pull/569))

  Now use support the following usage

  - mainthread event
  - mainthread ref
  - runOnMainThread/runOnBackground
  - ref.current.xx

- Updated dependencies [[`f1ca29b`](https://github.com/lynx-family/lynx-stack/commit/f1ca29bd766377dd46583f15e1e75bca447699cd), [`8ca9fcb`](https://github.com/lynx-family/lynx-stack/commit/8ca9fcbbc86b0f0ac05ee4319876cdd5dd08d668), [`efe6fd7`](https://github.com/lynx-family/lynx-stack/commit/efe6fd7de8a3d8119ea550f4d4e939d1fbfee4f0)]:
  - @lynx-js/web-mainthread-apis@0.12.0
  - @lynx-js/web-constants@0.12.0
  - @lynx-js/web-worker-rpc@0.12.0

## 0.11.0

### Patch Changes

- feat: support mts event handler (1/n) ([#495](https://github.com/lynx-family/lynx-stack/pull/495))

  now the main-thread:bind handler could be invoked. The params of the handler will be implemented later.

- feat: allow multi lynx-view to share bts worker ([#520](https://github.com/lynx-family/lynx-stack/pull/520))

  Now we allow users to enable so-called "shared-context" feature on the Web Platform.

  Similar to the same feature for Lynx iOS/Android, this feature let multi lynx cards to share one js context.

  The `lynx.getSharedData` and `lynx.setSharedData` are also supported in this commit.

  To enable this feature, set property `lynxGroupId` or attribute `lynx-group-id` before a lynx-view starts rendering. Those card with same context id will share one web worker for the bts scripts.

- Updated dependencies [[`ea42e62`](https://github.com/lynx-family/lynx-stack/commit/ea42e62fbcd5c743132c3e6e7c4851770742d544), [`a0f5ca4`](https://github.com/lynx-family/lynx-stack/commit/a0f5ca4ea0895ccbaa6aa63f449f53a677a1cf73)]:
  - @lynx-js/web-mainthread-apis@0.11.0
  - @lynx-js/web-constants@0.11.0
  - @lynx-js/web-worker-rpc@0.11.0

## 0.10.1

### Patch Changes

- feat: onNapiModulesCall function add new param: `dispatchNapiModules`, napiModulesMap val add new param: `handleDispatch`. ([#414](https://github.com/lynx-family/lynx-stack/pull/414))

  Now you can use them to actively communicate to napiModules (background thread) in onNapiModulesCall (ui thread).

- Updated dependencies [[`1af3b60`](https://github.com/lynx-family/lynx-stack/commit/1af3b6052ab27f98bf0e4d1b0ec9f7d9e88e0afc)]:
  - @lynx-js/web-constants@0.10.1
  - @lynx-js/web-mainthread-apis@0.10.1
  - @lynx-js/web-worker-rpc@0.10.1

## 0.10.0

### Minor Changes

- feat: rewrite the main thread Element PAPIs ([#343](https://github.com/lynx-family/lynx-stack/pull/343))

  In this commit we've rewritten the main thread apis.

  The most highlighted change is that

  - Before this commit we send events directly to bts
  - After this change, we send events to mts then send them to bts with some data combined.

### Patch Changes

- Updated dependencies [[`2a8ddf3`](https://github.com/lynx-family/lynx-stack/commit/2a8ddf3fb2a2fc5ed9b44184e30847aaf74fd1f4), [`3a8dabd`](https://github.com/lynx-family/lynx-stack/commit/3a8dabd877084c15db1404c912dd8a19c7a0fc59), [`878050a`](https://github.com/lynx-family/lynx-stack/commit/878050aaa3d9eb534848cab1dd0d4a2096a0a940), [`a521759`](https://github.com/lynx-family/lynx-stack/commit/a5217592f5aebea4b17860e729d523ecabb5f691), [`890c6c5`](https://github.com/lynx-family/lynx-stack/commit/890c6c51470c82104abb1049681f55e5d97cf9d6)]:
  - @lynx-js/web-mainthread-apis@0.10.0
  - @lynx-js/web-constants@0.10.0
  - @lynx-js/web-worker-rpc@0.10.0

## 0.9.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-constants@0.9.1
  - @lynx-js/web-mainthread-apis@0.9.1
  - @lynx-js/web-worker-rpc@0.9.1

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

- refactor: remove customelement defined detecting logic ([#247](https://github.com/lynx-family/lynx-stack/pull/247))

  Before this commit, for those element with tag without `-`, we always try to detect if the `x-${tagName}` is defined.

  After this commit, we pre-define a map(could be override by the `overrideLynxTagToHTMLTagMap`) to make that transformation for tag name.

  This change is a path to SSR and the MTS support.

- Updated dependencies [[`5b5e090`](https://github.com/lynx-family/lynx-stack/commit/5b5e090fdf0e896f1c38a49bf3ed9889117c4fb8), [`b844e75`](https://github.com/lynx-family/lynx-stack/commit/b844e751f566d924256365d37aec4c86c520ec00), [`53230f0`](https://github.com/lynx-family/lynx-stack/commit/53230f012216f3a627853e11d544e4be175c5b9b), [`6f16827`](https://github.com/lynx-family/lynx-stack/commit/6f16827d1f4d7364870d354fc805a8868c110f1e), [`d2d55ef`](https://github.com/lynx-family/lynx-stack/commit/d2d55ef9fe438c35921d9db0daa40d5228822ecc)]:
  - @lynx-js/web-constants@0.9.0
  - @lynx-js/web-mainthread-apis@0.9.0
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

### Patch Changes

- feat: add pixelRatio of SystemInfo, now you can use `SystemInfo.pixelRatio`. ([#150](https://github.com/lynx-family/lynx-stack/pull/150))

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

- Updated dependencies [[`e9e8370`](https://github.com/lynx-family/lynx-stack/commit/e9e8370e070a50cbf65a4ebc46c2e37ea1e0be40), [`ec4e1ce`](https://github.com/lynx-family/lynx-stack/commit/ec4e1ce0d7612d6c0701792a46c78cd52130bad4), [`f0a717c`](https://github.com/lynx-family/lynx-stack/commit/f0a717c630700e16ab0af7f1fe370fd60ac75b30), [`63fab7b`](https://github.com/lynx-family/lynx-stack/commit/63fab7b515b7456750b5f7e06844f244a20ca4f1)]:
  - @lynx-js/web-mainthread-apis@0.8.0
  - @lynx-js/web-constants@0.8.0
  - @lynx-js/web-worker-rpc@0.8.0

## 0.7.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb), [`2044571`](https://github.com/lynx-family/lynx-stack/commit/204457166531dae6e9f653db56b14187553b7666), [`82285ce`](https://github.com/lynx-family/lynx-stack/commit/82285cefbc87a5b9b9f5b79b082b5030d1a7b772), [`7da7601`](https://github.com/lynx-family/lynx-stack/commit/7da7601f00407970c485046ad73eeb8534aaa4f6)]:
  - @lynx-js/web-mainthread-apis@0.7.1
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
  - @lynx-js/web-constants@0.7.0
  - @lynx-js/web-mainthread-apis@0.7.0
  - @lynx-js/web-worker-rpc@0.7.0

## 0.6.2

### Patch Changes

- 085b99e: feat: add `nativeApp.createJSObjectDestructionObserver`, it is a prerequisite for implementing mts event.
- Updated dependencies [0412db0]
- Updated dependencies [085b99e]
  - @lynx-js/web-constants@0.6.2
  - @lynx-js/web-mainthread-apis@0.6.2
  - @lynx-js/web-worker-rpc@0.6.2

## 0.6.1

### Patch Changes

- 62b7841: feat: add lynx.requireModule in main-thread && \_\_LoadLepusChunk API.

  now the `lynx.requireModule` is available in mts.

- Updated dependencies [62b7841]
  - @lynx-js/web-mainthread-apis@0.6.1
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

- Updated dependencies [e406d69]
  - @lynx-js/web-mainthread-apis@0.6.0
  - @lynx-js/web-constants@0.6.0
  - @lynx-js/web-worker-rpc@0.6.0

## 0.5.1

### Patch Changes

- ee340da: feat: add SystemInfo.platform as 'web'. now you can use `SystemInfo.platform`.
- b5ef20e: feat: updateData should also call `updatePage` in main-thread.
- Updated dependencies [c49b1fb]
- Updated dependencies [b5ef20e]
  - @lynx-js/web-constants@0.5.1
  - @lynx-js/web-mainthread-apis@0.5.1
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

- 04607bd: refractor: do not create return endpoint for those rpcs don't need it
- Updated dependencies [04607bd]
- Updated dependencies [3050faf]
- Updated dependencies [7b84edf]
- Updated dependencies [e0f0793]
  - @lynx-js/web-worker-rpc@0.5.0
  - @lynx-js/web-constants@0.5.0
  - @lynx-js/web-mainthread-apis@0.5.0
