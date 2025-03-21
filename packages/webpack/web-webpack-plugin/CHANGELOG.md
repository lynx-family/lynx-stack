# @lynx-js/web-webpack-plugin

## 0.6.3

### Patch Changes

- chore: remove unused file ([#217](https://github.com/lynx-family/lynx-stack/pull/217))

- Updated dependencies [[`f447811`](https://github.com/lynx-family/lynx-stack/commit/f4478112a08d3cf2d1483b87d591ea4e3b6cc2ea)]:
  - @lynx-js/web-style-transformer@0.2.3

## 0.6.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb), [`399a6d9`](https://github.com/lynx-family/lynx-stack/commit/399a6d973024aa8a46ab2f2f13e7c82214066f9e)]:
  - @lynx-js/web-style-transformer@0.2.2

## 0.6.1

### Patch Changes

- fb4e383: fix: css variable does not work
- Updated dependencies [2738fdc]
  - @lynx-js/web-style-transformer@0.2.1

## 0.6.0

### Minor Changes

- 0d3b44c: **BREAKING CHANGE**: Require `@lynx-js/template-webpack-plugin` v0.6.0.

## 0.5.0

### Minor Changes

- d156485: feat: use the encodeData.sourceContent.dsl to infer the cardType field
- e406d69: refractor: update output json format

  **This is a breaking change**

  Before this change the style info is dump in Javascript code.

  After this change the style info will be pure JSON data.

  Now we're using the css-serializer tool's output only. If you're using plugins for it, now they're enabled.

### Patch Changes

- Updated dependencies [e406d69]
  - @lynx-js/web-style-transformer@0.2.0

## 0.4.0

### Minor Changes

- 7b84edf: feat: introduce new output chunk format

  **This is a breaking change**

  After this commit, we new introduce a new output format for web platform.

  This new output file is a JSON file, includes all essential info.

  Now we'll add the chunk global scope wrapper on runtime, this will help us to provide a better backward compatibility.

  Also we have a intergrated output file cache for one session.

  Now your `output.filename` will work.

  The split-chunk feature has been temporary removed until the rspeedy team supports this feature for us.

## 0.3.1

### Patch Changes

- 958efda: feat(web): bundle background.js into main-thread.js for web

  To enable this feature:

  1. set the performance.chunkSplit.strategy to `all-in-one`
  2. use the `mode:'production'` to build

  The output will be only one file.

## 0.3.0

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

### Patch Changes

- 92fc11e: fix: do not add prefix/suffix for at rules
- 828e688: fix: `@keyframes` with from and to

## 0.2.1

### Patch Changes

- 6730c58: Add `globDynamicComponentEntry`
- 00ab1ef: Fix wrong peerDependencies

## 0.2.0

### Minor Changes

- f022c94: **BREAKING CHANGE**: Require `@lynx-js/template-webpack-plugin` v0.5.2.
- 267c935: feat: make cardType could be configurable

### Patch Changes

- 47cb40c: Make `SystemInfo` defaults to `{}`.
- 667593b: refractor: change the stage of web banner

  1. We already required the react-rsbuild-plugin to make sure that the minifizer be correctly configurated for esm chunk.

  2. use `var` to declare global identifiers

## 0.1.1

### Patch Changes

- 272db24: refractor: the main-thread worker will be dedicated for every lynx view
- Updated dependencies [36e140f]
  - @lynx-js/template-webpack-plugin@0.1.1

## 0.1.0

### Minor Changes

- 06fe3cd: feat: support splitchunk and lynx.requireModuleAsync

  - support splitchunk option of rspeedy
  - add implementation for lynx.requireModuleAsync for both main-thread and background-thread
  - mark worker `ready` after \_OnLifeCycleEvent is assigned

  close #96

- 66ce343: feat: support config `defaultDisplayLinear`
- 068f677: feat: suppport createSelectorQuery
- d551d81: feat: support customSection

  - support lynx.getCustomSection
  - support lynx.getCustomSectionSync

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

- 269bf61: feat: support rspeedy layer model and support sharing chunk between main and background
- 29f24aa: feat(web): support removeCSSScope:false

  - add element api `__SetCSSId`
  - add new WebpackPlugin `@lynx-js/web-webpack-plugin`
  - add support for removeCSSSCope
  - pass all configs via thie \*.lepus.js
  - support to scope styles of lynx card for browsers do not support `@scope` and nesting

- c04669b: feat: migrate to new TemplatePlugin hooks
- 6e003e8: feat(web): support linear layout and add tests

### Patch Changes

- d5bfac6: Fix import error.
- fe0d06f: fix: \_\_globalProps is not defined
- Updated dependencies [84e49f5]
- Updated dependencies [f28650f]
- Updated dependencies [39cf3ae]
- Updated dependencies [f1ddb5a]
- Updated dependencies [6e003e8]
- Updated dependencies [d05e60b]
  - @lynx-js/template-webpack-plugin@0.1.0
  - @lynx-js/web-style-transformer@0.1.0
