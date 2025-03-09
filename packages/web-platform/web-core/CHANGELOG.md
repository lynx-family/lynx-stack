# @lynx-js/web-core

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
  * @param {Cloneable} initData [oprional] The initial data of this Lynx card
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
