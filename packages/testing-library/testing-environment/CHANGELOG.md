# @lynx-js/testing-environment

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
