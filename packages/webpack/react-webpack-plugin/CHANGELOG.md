# @lynx-js/react-webpack-plugin

## 0.6.13

### Patch Changes

- feat: add `experimental_isLazyBundle` option, it will disable snapshot HMR for standalone lazy bundle ([#653](https://github.com/lynx-family/lynx-stack/pull/653))

- Add the `profile` option to control whether `__PROFILE__` is enabled. ([#722](https://github.com/lynx-family/lynx-stack/pull/722))

- Support `@lynx-js/react` v0.108.0. ([#649](https://github.com/lynx-family/lynx-stack/pull/649))

## 0.6.12

### Patch Changes

- Support @lynx-js/react v0.107.0 ([#438](https://github.com/lynx-family/lynx-stack/pull/438))

## 0.6.11

### Patch Changes

- feat: fully support MTS ([#569](https://github.com/lynx-family/lynx-stack/pull/569))

  Now use support the following usage

  - mainthread event
  - mainthread ref
  - runOnMainThread/runOnBackground
  - ref.current.xx

## 0.6.10

### Patch Changes

- feat: add extractStr option to pluginReactLynx ([#391](https://github.com/lynx-family/lynx-stack/pull/391))

- Fix issue with lazy loading of bundles when source maps are enabled. ([#380](https://github.com/lynx-family/lynx-stack/pull/380))

- Fix issue where loading a lazy bundle fails if it does not return a webpack chunk. ([#365](https://github.com/lynx-family/lynx-stack/pull/365))

## 0.6.9

### Patch Changes

- Support `@lynx-js/react` v0.106.0. ([#239](https://github.com/lynx-family/lynx-stack/pull/239))

## 0.6.8

### Patch Changes

- Shake `useImperativeHandle` on the main-thread by default. ([#153](https://github.com/lynx-family/lynx-stack/pull/153))

  ```js
  import { forwardRef, useImperativeHandle } from '@lynx-js/react';

  export default forwardRef(function App(_, ref) {
    useImperativeHandle(ref, () => {
      // This should be considered as background only
      return {
        name() {
          // This should be considered as background only
          console.info('This should not exist in main-thread');
        },
      };
    });
  });
  ```

- Avoid wrapping standalone lazy bundles with `var globDynamicComponentEntry`. ([#177](https://github.com/lynx-family/lynx-stack/pull/177))

## 0.6.7

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/webpack-runtime-globals@0.0.5

## 0.6.6

### Patch Changes

- 1abf8f0: Be compat with `@lynx-js/react` v0.105.0
- 1abf8f0: Improve compilation performance by avoid using `compilation.updateAsset`.

## 0.6.5

### Patch Changes

- 94419fb: Support `@lynx-js/react` v0.104.0
- 1bf9271: fix(react): default `compat` in transform to `false`

## 0.6.4

### Patch Changes

- 0d3b44c: Support `@lynx-js/template-webpack-plugin` v0.6.0.
- 74e0ea3: Supports new `__MAIN_THREAD__` and `__BACKGROUND__` macro as an alternative to `__LEPUS__` and `__JS__`.

## 0.6.3

### Patch Changes

- 65ecd41: Fix `module` is not defined when using lazy bundle.

## 0.6.2

### Patch Changes

- 3bf5830: Add `lynxProcessEvalResult`.
- Updated dependencies [3bf5830]
  - @lynx-js/webpack-runtime-globals@0.0.4

## 0.6.1

### Patch Changes

- e8039f2: Add `defineDCE` in plugin options. Often used to define custom macros.

  ```js
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
  import { defineConfig } from '@lynx-js/rspeedy';

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        defineDCE: {
          __SOME_FALSE_DEFINE__: 'false',
        },
      }),
    ],
  });
  ```

  Different from `define` provided by bundlers like webpack, `defineDCE` works at transform time and a extra DCE (Dead Code Elimination) pass will be performed.

  For example, `import` initialized by dead code will be removed:

  ```js
  import { foo } from 'bar';

  if (__SOME_FALSE_DEFINE__) {
    foo();
    console.log('dead code');
  } else {
    console.log('reachable code');
  }
  ```

  will be transformed to:

  ```js
  console.log('reachable code');
  ```

## 0.6.0

### Minor Changes

- a30c83d: Add `compat.removeComponentAttrRegex`.

  ```js
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
  import { defineConfig } from '@lynx-js/rspeedy';

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        compat: {
          removeComponentAttrRegex: 'YOUR REGEX',
        },
      }),
    ],
  });
  ```

  NOTE: This feature is deprecated and will be removed in the future. Use codemod instead.

- 5f8d492: **BREAKING CHANGE**: Require `@lynx-js/react` v0.103.0.
- 5f8d492: Deprecate `compat.simplifyCtorLikeReactLynx2`

## 0.5.2

### Patch Changes

- e3be842: Support `@lynx-js/react` v0.102.0
- 21dba89: Add `options.shake` to allow custom package names to be shaken.

## 0.5.1

### Patch Changes

- 6730c58: Support `@lynx-js/react` v0.101.0
- 63f40cc: Inject `globDynamicComponentEntry` for all main thread script.

  |             |     Before      |     After      |
  | :---------: | :-------------: | :------------: |
  | Main Bundle |   Not defined   | Defined(local) |
  | Lazy Bundle | Defined(params) | Defined(local) |

## 0.5.0

### Minor Changes

- 587a782: **BRAKING CHANGE**: Require `@lynx-js/react` v0.100.0

### Patch Changes

- 1938bb1: Add `transformPath` to loader option
- 1938bb1: Make peerDependencies of `@lynx-js/react` optional.
