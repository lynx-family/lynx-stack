# @lynx-js/web-constants

## 0.17.2

### Patch Changes

- feat: support load bts chunk from remote address ([#1834](https://github.com/lynx-family/lynx-stack/pull/1834))

  - re-support chunk splitting
  - support lynx.requireModule with a json file
  - support lynx.requireModule, lynx.requireModuleAsync with a remote url
  - support to add a breakpoint in chrome after reloading the web page

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.17.2

## 0.17.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.17.1

## 0.17.0

### Patch Changes

- fix: avoid duplicate style transformation ([#1748](https://github.com/lynx-family/lynx-stack/pull/1748))

  After this commit, we use DAG methods to handle the styleInfos

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.17.0

## 0.16.1

### Patch Changes

- feat: supports lazy bundle. (This feature requires `@lynx-js/lynx-core >= 0.1.3`) ([#1235](https://github.com/lynx-family/lynx-stack/pull/1235))

- Updated dependencies []:
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

- fix: the SystemInfo in bts should be assigned to the globalThis ([#1599](https://github.com/lynx-family/lynx-stack/pull/1599))

- Updated dependencies [[`c1f8715`](https://github.com/lynx-family/lynx-stack/commit/c1f8715a81b2e69ff46fc363013626db4468c209)]:
  - @lynx-js/web-worker-rpc@0.16.0

## 0.15.7

### Patch Changes

- fix: globalThis is never accessible in MTS ([#1531](https://github.com/lynx-family/lynx-stack/pull/1531))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.7

## 0.15.6

### Patch Changes

- fix: systeminfo in mts function ([#1537](https://github.com/lynx-family/lynx-stack/pull/1537))

- feat: add MTS API: \_\_UpdateComponentInfo ([#1485](https://github.com/lynx-family/lynx-stack/pull/1485))

- fix: `__ElementFromBinary` needs to correctly apply the dataset in elementTemplate to the Element ([#1487](https://github.com/lynx-family/lynx-stack/pull/1487))

- fix: all attributes except `id` and `type` under ElementTemplateData are optional. ([#1483](https://github.com/lynx-family/lynx-stack/pull/1483))

- feat: add MTS API \_\_GetAttributeByName ([#1486](https://github.com/lynx-family/lynx-stack/pull/1486))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.6

## 0.15.5

### Patch Changes

- fix: load main-thread chunk in ESM format ([#1437](https://github.com/lynx-family/lynx-stack/pull/1437))

  See [nodejs/node#59362](https://github.com/nodejs/node/issues/59362) for more details.

- feat: support path() for `createQuerySelector` ([#1456](https://github.com/lynx-family/lynx-stack/pull/1456))

  - Added `getPathInfo` API to `NativeApp` and its cross-thread handler for retrieving the path from a DOM node to the root.
  - Implemented endpoint and handler registration in both background and UI threads.
  - Implemented `nativeApp.getPathInfo()`

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.5

## 0.15.4

### Patch Changes

- feat: support `__ElementFromBinary` ([#1391](https://github.com/lynx-family/lynx-stack/pull/1391))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.4

## 0.15.3

### Patch Changes

- fix: improve compatibility with legacy template ([#1337](https://github.com/lynx-family/lynx-stack/pull/1337))

  avoid "object Object" error for old version rspeedy outputs

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.3

## 0.15.2

### Patch Changes

- feat: move SSR hydrate essential info to the ssr attribute ([#1292](https://github.com/lynx-family/lynx-stack/pull/1292))

  We found that in browser there is no simple tool to decode a base64 string

  Therefore we move the data to `ssr` attribute

  Also fix some ssr issues

- feat: support \_\_MarkTemplateElement, \_\_MarkPartElement and \_\_GetTemplateParts for all-on-ui ([#1275](https://github.com/lynx-family/lynx-stack/pull/1275))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.2

## 0.15.1

### Patch Changes

- Updated dependencies []:
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

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.15.0

## 0.14.2

### Patch Changes

- feat: merge multiple markTiming RPC communication events together and send them together, which can effectively reduce the number of RPC communications. ([#1178](https://github.com/lynx-family/lynx-stack/pull/1178))

- chore: extract shared logic from web-core and web-core-server's loadTemplate into a unified generateTemplate function ([#1211](https://github.com/lynx-family/lynx-stack/pull/1211))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.14.2

## 0.14.1

### Patch Changes

- feat: support BTS API `lynx.reportError` && `__SetSourceMapRelease`, now you can use it and handle it in lynx-view error event. ([#1059](https://github.com/lynx-family/lynx-stack/pull/1059))

- fix: in lynx-view all-on-ui mode, the input event of input and textarea is triggered twice, and the first e.detail is a string, which does not conform to the expected data format. ([#1179](https://github.com/lynx-family/lynx-stack/pull/1179))

- fix: under the all-on-ui strategy, reload() will add two page elements. ([#1147](https://github.com/lynx-family/lynx-stack/pull/1147))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.14.1

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

- refactor: make the opcode be a plain array ([#1051](https://github.com/lynx-family/lynx-stack/pull/1051))

  #1042

- feat: add `updateI18nResources` method of lynx-view. ([#1085](https://github.com/lynx-family/lynx-stack/pull/1085))

  Now you can use `updateI18nResources` to update i18nResources, and then use \_I18nResourceTranslation() to get the updated result.

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.14.0

## 0.13.5

### Patch Changes

- refactor: move some internal status to dom's attribute ([#945](https://github.com/lynx-family/lynx-stack/pull/945))

  It's essential for SSR

- fix: target.id is undefined ([#1016](https://github.com/lynx-family/lynx-stack/pull/1016))

- feat: add new pageConfig configuration: enableJSDataProcessor ([#886](https://github.com/lynx-family/lynx-stack/pull/886))

- refactor: move component config info to attribute ([#984](https://github.com/lynx-family/lynx-stack/pull/984))

- refactor: save dataset on an attribute ([#981](https://github.com/lynx-family/lynx-stack/pull/981))

  On lynx, the `data-*` attributes have different behaviors than the HTMLElement has.

  The dataset will be treated as properties, the key will not be applied the camel-case <-> hyphenate name transformation.

  Before this commit we use it as a runtime data, but after this commit we will use encodeURI(JSON.stringify(dataset)) to encode it as a string.

- refactor: create elements of `elementToRuntimeInfoMap` on demand ([#986](https://github.com/lynx-family/lynx-stack/pull/986))

- refactor: implement mts apis in closure pattern ([#1004](https://github.com/lynx-family/lynx-stack/pull/1004))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.5

## 0.13.4

### Patch Changes

- feat: lynx-view supports `updateGlobalProps` method, which can be used to update lynx.\_\_globalProps ([#918](https://github.com/lynx-family/lynx-stack/pull/918))

- feat: supports `lynx.getElementById()` && `animate()`. ([#912](https://github.com/lynx-family/lynx-stack/pull/912))

  After this commit, you can use `lynx.getElementById()` to get the element by id, and use `element.animate()` to animate the element.

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.4

## 0.13.3

### Patch Changes

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.3

## 0.13.2

### Patch Changes

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.2

## 0.13.1

### Patch Changes

- feat: support touch events for MTS ([#641](https://github.com/lynx-family/lynx-stack/pull/641))

  now we support

  - main-thread:bindtouchstart
  - main-thread:bindtouchend
  - main-thread:bindtouchmove
  - main-thread:bindtouchcancel

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.1

## 0.13.0

### Patch Changes

- refactor: isolate SystemInfo ([#628](https://github.com/lynx-family/lynx-stack/pull/628))

  Never assign `SystemInfo` on worker's self object.

- refactor: move mainthread impl into mainthread-api packages ([#622](https://github.com/lynx-family/lynx-stack/pull/622))

- fix(web): css selector not work for selectors with combinator and pseudo-class on WEB ([#608](https://github.com/lynx-family/lynx-stack/pull/608))

  like `.parent > :not([hidden]) ~ :not([hidden])`

  you will need to upgrade your `react-rsbuild-plugin` to fix this issue

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.13.0

## 0.12.0

### Patch Changes

- feat: fully support MTS ([#569](https://github.com/lynx-family/lynx-stack/pull/569))

  Now use support the following usage

  - mainthread event
  - mainthread ref
  - runOnMainThread/runOnBackground
  - ref.current.xx

- Updated dependencies []:
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

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.11.0

## 0.10.1

### Patch Changes

- feat: onNapiModulesCall function add new param: `dispatchNapiModules`, napiModulesMap val add new param: `handleDispatch`. ([#414](https://github.com/lynx-family/lynx-stack/pull/414))

  Now you can use them to actively communicate to napiModules (background thread) in onNapiModulesCall (ui thread).

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.10.1

## 0.10.0

### Minor Changes

- feat: rewrite the main thread Element PAPIs ([#343](https://github.com/lynx-family/lynx-stack/pull/343))

  In this commit we've rewritten the main thread apis.

  The most highlighted change is that

  - Before this commit we send events directly to bts
  - After this change, we send events to mts then send them to bts with some data combined.

### Patch Changes

- feat: The onNapiModulesCall function of lynx-view provides the fourth parameter: `lynxView`, which is the actual lynx-view DOM. ([#350](https://github.com/lynx-family/lynx-stack/pull/350))

- fix: publicComponentEvent args order ([#401](https://github.com/lynx-family/lynx-stack/pull/401))

- Updated dependencies [[`a521759`](https://github.com/lynx-family/lynx-stack/commit/a5217592f5aebea4b17860e729d523ecabb5f691)]:
  - @lynx-js/web-worker-rpc@0.10.0

## 0.9.1

### Patch Changes

- Updated dependencies []:
  - @lynx-js/web-worker-rpc@0.9.1

## 0.9.0

### Minor Changes

- refractor: remove entryId concept ([#217](https://github.com/lynx-family/lynx-stack/pull/217))

  After the PR #198
  All contents are isolated by a shadowroot.
  Therefore we don't need to add the entryId selector to avoid the lynx-view's style taking effect on the whole page.

### Patch Changes

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

- refactor: clean the decodeOperations implementation ([#261](https://github.com/lynx-family/lynx-stack/pull/261))

- refactor: remove customelement defined detecting logic ([#247](https://github.com/lynx-family/lynx-stack/pull/247))

  Before this commit, for those element with tag without `-`, we always try to detect if the `x-${tagName}` is defined.

  After this commit, we pre-define a map(could be override by the `overrideLynxTagToHTMLTagMap`) to make that transformation for tag name.

  This change is a path to SSR and the MTS support.

- Updated dependencies [[`53230f0`](https://github.com/lynx-family/lynx-stack/commit/53230f012216f3a627853e11d544e4be175c5b9b)]:
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

- feat: `createRpcEndpoint` adds a new parameter: `hasReturnTransfer`. ([#194](https://github.com/lynx-family/lynx-stack/pull/194))

  When `isSync`: false, `hasReturn`: true, you can add `transfer` to the callback postMessage created.

  At this time, the return value structure of register-handler is changed: `{ data: unknown; transfer: Transferable[]; } | Promise<{ data: unknown; transfer: Transferable[];}>`.

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

- Updated dependencies [[`ec4e1ce`](https://github.com/lynx-family/lynx-stack/commit/ec4e1ce0d7612d6c0701792a46c78cd52130bad4)]:
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

- refractor: improve some internal logic for element creating in MTS ([#71](https://github.com/lynx-family/lynx-stack/pull/71))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/web-worker-rpc@0.7.1

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

- @lynx-js/web-worker-rpc@0.7.0

## 0.6.2

### Patch Changes

- 0412db0: fix: The runtime wrapper parameter name is changed from `runtime` to `lynx_runtime`.

  This is because some project logic may use `runtime`, which may cause duplication of declarations.

- 085b99e: feat: add `nativeApp.createJSObjectDestructionObserver`, it is a prerequisite for implementing mts event.
  - @lynx-js/web-worker-rpc@0.6.2

## 0.6.1

### Patch Changes

- 62b7841: feat: add lynx.requireModule in main-thread && \_\_LoadLepusChunk API.

  now the `lynx.requireModule` is available in mts.

  - @lynx-js/web-worker-rpc@0.6.1

## 0.6.0

### Minor Changes

- e406d69: refractor: update output json format

  **This is a breaking change**

  Before this change the style info is dump in Javascript code.

  After this change the style info will be pure JSON data.

  Now we're using the css-serializer tool's output only. If you're using plugins for it, now they're enabled.

### Patch Changes

- @lynx-js/web-worker-rpc@0.6.0

## 0.5.1

### Patch Changes

- c49b1fb: feat: updateData api needs to have the correct format, now you can pass a callback.
- b5ef20e: feat: updateData should also call `updatePage` in main-thread.
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
- Updated dependencies [04607bd]
- Updated dependencies [e0f0793]
  - @lynx-js/web-worker-rpc@0.5.0

## 0.4.2

### Patch Changes

- 168b4fa: feat: rename CloneableObject to Cloneable, Now its type refers to a structure that can be cloned; CloneableObject type is added, which only refers to object types that can be cloned.

## 0.4.1

## 0.4.0

## 0.3.1

## 0.3.0

### Minor Changes

- 267c935: feat: make cardType could be configurable

### Patch Changes

- 6e873bc: fix: incorrect parent component id value on publishComponentEvent

## 0.2.0

## 0.1.0

### Minor Changes

- 2973ba5: chore: add common constants
