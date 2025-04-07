# @lynx-js/web-worker-runtime

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
