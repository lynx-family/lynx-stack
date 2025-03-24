# @lynx-js/template-webpack-plugin

## 0.6.6

### Patch Changes

- expose main.lynx.bundle to compiler ([#231](https://github.com/lynx-family/lynx-stack/pull/231))

## 0.6.5

### Patch Changes

- The code of lazy bundle should be minimized. ([#177](https://github.com/lynx-family/lynx-stack/pull/177))

## 0.6.4

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Use WASM when NAPI is not available. ([#138](https://github.com/lynx-family/lynx-stack/pull/138))

- Add `defaultOverflowVisible` option to `LynxTemplatePlugin`. ([#78](https://github.com/lynx-family/lynx-stack/pull/78))

  ```js
  import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

  new LynxTemplatePlugin({
    defaultOverflowVisible: false,
  });
  ```

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/webpack-runtime-globals@0.0.5
  - @lynx-js/css-serializer@0.1.2

## 0.6.3

### Patch Changes

- 1abf8f0: Set the default value of `enableNativeList` to `true`.
- 1abf8f0: Add `entryNames` parameter to `beforeEncode` hook.

  ```js
  import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

  const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);
  hooks.beforeEncode.tap('MyPlugin', ({ entryNames }) => {
    console.log(entryNames);
  });
  ```

- 1abf8f0: Set the default `targetSdkVersion` to 3.2.

## 0.6.2

### Patch Changes

- 1472918: Change the lazy bundle filename to `async/[name].[fullhash].bundle`.

## 0.6.1

### Patch Changes

- ad49fb1: Support CSS HMR for ReactLynx
- 1407bac: Avoid special chunk id (e.g. "@scope/some-pkg-react:main-thread") to corrupt main-thread.js

## 0.6.0

### Minor Changes

- a217b02: **BREAKING CHANGE**: Require `@lynx-js/css-extract-webpack-plugin` v0.4.0.
- 0d3b44c: **BREAKING CHANGE**: Move `beforeEmit` and `afterEmit` hooks from `LynxEncodePlugin` to `LynxTemplatePlugin`.

  Use `LynxTemplatePlugin.getLynxTemplatePluginHooks` instead.

  ```diff
  - const hooks = LynxEncodePlugin.getLynxEncodePluginHooks()
  + const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks()
  ```

### Patch Changes

- 227823b: Use `async/[name]/template.[fullhash].js` for lazy template.

## 0.5.7

### Patch Changes

- d156485: feat: add the type of `sourceContent` field
- 3ca4c67: Add `enableICU` to the options of pluginReactLynx, and change the default value to `false`.
- Updated dependencies [1f791a3]
  - @lynx-js/css-serializer@0.1.1

## 0.5.6

### Patch Changes

- 39efd7c: Change `enableRemoveCSSScope` defaults from `undefined` to `true`, now `enableRemoveCSSScope` can be:

  - `true` (by default): All CSS files are treated as global CSS.
  - `false`: All CSS files are treated as scoped CSS, and only take effect in the component that explicitly imports it.
  - `undefined`: Only use scoped CSS for CSS Modules, and treat other CSS files as global CSS. Scoped CSS is faster than global CSS, thus you can use CSS Modules to speedy up your CSS if there are performance issues.

- a2f8bad: Avoid extra `loadScript` calls.
- f1d6095: Add `pipelineSchedulerConfig` option.
- Updated dependencies [3bf5830]
  - @lynx-js/webpack-runtime-globals@0.0.4

## 0.5.5

### Patch Changes

- 8dd6cca: Revert "perf(webpack/template): make `generatingTemplate` async"([#493](https://github.com/lynx-wg/lynx-stack/pull/493)).

## 0.5.4

### Patch Changes

- 89248b7: Delay the generation of templates in development rebuild.
- bf9ec8c: Delete `main-thread.js` in production.

## 0.5.3

### Patch Changes

- 36f8e4c: Add `enableA11y` and `enableAccessibilityElement`.
- 84cbdfe: Integrate with `@lynx-js/tasm`.

## 0.5.2

### Patch Changes

- Updated dependencies [f5913e5]
  - @lynx-js/webpack-runtime-globals@0.0.3

## 0.1.1

### Patch Changes

- 36e140f: Add missing `enableReuseContext` flag

## 0.1.0

### Minor Changes

- 84e49f5: update @lynx-js/template-webpack-plugin
- d05e60b: chore: add more exports of template-webpack-plugin

### Patch Changes

- f1ddb5a: fix: return the correct entry chunk of background compilation
- Updated dependencies [6c31ddd]
- Updated dependencies [51d94d0]
- Updated dependencies [36e5ddb]
- Updated dependencies [6d05c70]
  - @lynx-js/css-serializer@0.1.0
  - @lynx-js/webpack-runtime-globals@0.0.2
