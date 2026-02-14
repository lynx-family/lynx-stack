# @lynx-js/testing-environment

## 0.1.11

### Patch Changes

- Remove element api calls alog by default, and only enable it when `__ALOG_ELEMENT_API__` is defined to `true` or environment variable `REACT_ALOG_ELEMENT_API` is set to `true`. ([#2192](https://github.com/lynx-family/lynx-stack/pull/2192))

## 0.1.10

### Patch Changes

- Fix the error "lynxTestingEnv is not defined" ([#2118](https://github.com/lynx-family/lynx-stack/pull/2118))

## 0.1.9

### Patch Changes

- Fix duplicated `<page />` elements on body when multiple `__CreatePage` called. ([#2065](https://github.com/lynx-family/lynx-stack/pull/2065))

## 0.1.8

### Patch Changes

- Fix the "ReferenceError: Node is not defined" error. ([#1850](https://github.com/lynx-family/lynx-stack/pull/1850))

  This error would happen when upgrading to `@testing-library/jest-dom` [v6.9.0](https://github.com/testing-library/jest-dom/releases/tag/v6.9.0).

## 0.1.7

### Patch Changes

- Support `lynx.createSelectorQuery().select()` and `setNativeProps` API ([#1570](https://github.com/lynx-family/lynx-stack/pull/1570))

## 0.1.6

### Patch Changes

- Fix that `lynxTestingEnv.jsdom` cannot be initialized correctly when `global.jsdom` is not defined. ([#1422](https://github.com/lynx-family/lynx-stack/pull/1422))

## 0.1.5

### Patch Changes

- Fix `GlobalEventEmitter` type definition, the `emit(eventName: string, data: unknown)` function should recevie an array typed `data` and pass as param list of listeners. ([#1479](https://github.com/lynx-family/lynx-stack/pull/1479))

## 0.1.4

### Patch Changes

- Fix the thread switching bug in `lynx.getCoreContext` and `lynx.getJSContext`. ([#1244](https://github.com/lynx-family/lynx-stack/pull/1244))

## 0.1.3

### Patch Changes

- Support alog of component rendering on production for better error reporting. Enable it by using `REACT_ALOG=true rspeedy dev/build` or defining `__ALOG__` to `true` in `lynx.config.js`: ([#1164](https://github.com/lynx-family/lynx-stack/pull/1164))

  ```js
  export default defineConfig({
    // ...
    source: {
      define: {
        __ALOG__: true,
      },
    },
  });
  ```

- Supports `console.alog` and use different `console` object in main thread and background thread. ([#1164](https://github.com/lynx-family/lynx-stack/pull/1164))

## 0.1.2

### Patch Changes

- Fix the infinite loop in the `__RemoveElement` element PAPI. ([#1263](https://github.com/lynx-family/lynx-stack/pull/1263))

## 0.1.1

### Patch Changes

- Fix `getJSContext` or `getCoreContext` is not a function. ([#1122](https://github.com/lynx-family/lynx-stack/pull/1122))

## 0.1.0

### Minor Changes

- Switch to ESM package format by setting `"type": "module"`. ([#703](https://github.com/lynx-family/lynx-stack/pull/703))

### Patch Changes

- rename @lynx-js/test-environment to @lynx-js/testing-environment ([#704](https://github.com/lynx-family/lynx-stack/pull/704))

## 0.0.1

### Patch Changes

- Add testing library for ReactLynx ([#74](https://github.com/lynx-family/lynx-stack/pull/74))
