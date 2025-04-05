# @lynx-js/web-mainthread-apis

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
