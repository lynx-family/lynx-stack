# @lynx-js/react-webpack-plugin

## 0.10.0

### Minor Changes

- Stop injecting `webpackChunkName` into dynamic imports so lazy bundle intermediate files stay inside the output directory. ([#2961](https://github.com/lynx-family/lynx-stack/pull/2961))

  The ReactLynx transform injected `webpackChunkName: "<request>-react__<layer>"`, so a dynamic import resolving above the compiler context (e.g. `import('../../Foo.js')`) leaked `../` into `[name]`/`[id]` and the intermediate js/css/hmr files escaped the output directory. Async chunks now keep rspack's own ids, `__webpack_require__.lynx_aci` maps them by chunk id, and each lazy bundle's intermediate JS and CSS are emitted under `.rspeedy/async/<bundle-name>/<layer>.js` and `<layer>.css` next to its other intermediate outputs (`tasm.json`, `debug-metadata.json`, CSS hot-update files). Explicit `webpackChunkName` comments written by users are still honored and keep the user-controlled `[name]` placement. Main-thread chunks no longer emit CSS hot-update files — CSS only exists on the background thread, and the main-thread HMR runtime receives updates from it.

  These packages release together and must be upgraded together: `@lynx-js/react-webpack-plugin` and `@lynx-js/css-extract-webpack-plugin` require `@lynx-js/template-webpack-plugin` `^0.13.0`, and `@lynx-js/react-rsbuild-plugin` requires `@lynx-js/react` `^0.123.0`.

- Route `processEvalResult` to the host that requested the lazy bundle, so multiple ([#2584](https://github.com/lynx-family/lynx-stack/pull/2584))
  hosts on one page each get their own eval result instead of sharing a single one.

- Add `firstScreenSyncTiming: 'manual'` and a new `markFirstScreenSyncReady()` API exported by `@lynx-js/react`. ([#2826](https://github.com/lynx-family/lynx-stack/pull/2826))

  In `'manual'` mode, the main thread holds the UI control after the first screen until the business calls `markFirstScreenSyncReady()`, so the handover timing to the background thread (for hydration) is fully controlled by the user. The API can be called from both threads (a background-thread call is forwarded to the main thread) and takes effect once the first-screen tree has finished rendering.

  ```js
  pluginReactLynx({
    firstScreenSyncTiming: 'manual',
  });
  ```

  ```js
  import { markFirstScreenSyncReady } from '@lynx-js/react';

  markFirstScreenSyncReady();
  ```

### Patch Changes

- Add `compat.legacySlot` to `pluginReactLynx`. When enabled, dynamic children are compiled to the pre-SlotV2 form (JSX `children` + `wrapper` elements + `__DynamicPartChildren`/`__DynamicPartSlot` symbols instead of `$0`/`$1` slot props + `SlotV2`), so the compiled output stays compatible with legacy runtimes without `SlotV2` support (`< 0.120.0`, which shipped the SlotV2 refactor in #1764) — e.g. a standalone lazy bundle consumed by a host App that ships an older runtime. ([#2947](https://github.com/lynx-family/lynx-stack/pull/2947))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy';
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        compat: {
          legacySlot: true,
        },
      }),
    ],
  });
  ```

  The default (SlotV2) codegen is unchanged, and the runtime keeps supporting both forms.

- Fix `globDynamicComponentEntry is not defined` when an external bundle's main-thread section is evaluated. An external bundle is not a dynamic component, so `globDynamicComponentEntry` (only in scope for the main card and dynamic components) is undeclared there. The snapshot / element-template transform now bakes the `__Card__` entry name into an external bundle's snapshots instead of referencing the bare identifier, via a new internal `isExternalBundle` loader option. ([#2934](https://github.com/lynx-family/lynx-stack/pull/2934))

- Updated dependencies [[`fec4237`](https://github.com/lynx-family/lynx-stack/commit/fec4237b2257455a40a68f33864fb713c147f7d4)]:
  - @lynx-js/webpack-runtime-globals@0.0.7

## 0.9.5

### Patch Changes

- Support enabling preact devtools in production via the `REACT_DEVTOOL` environment variable. ([#2880](https://github.com/lynx-family/lynx-stack/pull/2880))

  By default `@lynx-js/preact-devtools` is aliased away in production builds. Setting the `REACT_DEVTOOL` environment variable now:

  1. keeps a user-imported `@lynx-js/preact-devtools` from being stripped;
  2. defines `__REACT_DEVTOOL__`, which gates the dev-only runtime hooks devtools depends on (such as `injectLepusMethods`) so they also run in production;
  3. keeps function/class names during minification (`keep_fnames`/`keep_classnames`), which devtools needs to resolve component names (`type.name`) and to reconstruct the hook tree (it matches minified stack frames by function name).

  `@lynx-js/react/debug` remains development-only.

## 0.9.4

### Patch Changes

- Support the unified `debug-metadata.json` format and depend on `@lynx-js/debug-metadata`. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

- Prefix Lynx runtime module names with `webpack/runtime/` (e.g. `Lynx async chunks` → `webpack/runtime/lynx async chunks`), matching the path-structured naming of the bundler's built-in runtime modules. The previous bare names had no path segment, so when they appear as a source-map `sources` entry under a `file://` module-filename template they collapsed into an invalid URL authority (the space-containing name became the host) and broke `SourceMapConsumer` parsing. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

- Widen peer ranges to admit the new minor versions of `@lynx-js/template-webpack-plugin` (^0.12.0) and `@lynx-js/rspeedy` (^0.15.0) shipping with the unified `debug-metadata.json` feature. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

- Updated dependencies [[`a839d59`](https://github.com/lynx-family/lynx-stack/commit/a839d59b7f477a86f2cd10215d0b754264e54425), [`d3201df`](https://github.com/lynx-family/lynx-stack/commit/d3201dfa57964bfe6c8c52a803aeeb0fca1f2d27), [`409594b`](https://github.com/lynx-family/lynx-stack/commit/409594b9c51bb0c13f01c7d3f16949b27ebfdced), [`353363e`](https://github.com/lynx-family/lynx-stack/commit/353363e52dca3b252b39b34a3a87ce840dd308f3)]:
  - @lynx-js/debug-metadata@0.1.0

## 0.9.3

### Patch Changes

- Inject the `lynxProcessEvalResult` runtime module only into main-thread chunks. The previous guard checked the chunk name for `:background`, which never matched the actual chunk names (`main__background`, `foo.js-react__background`), so the runtime was duplicated into background and async background chunks. ([#2692](https://github.com/lynx-family/lynx-stack/pull/2692))

## 0.9.2

### Patch Changes

- Support `@lynx-js/template-webpack-plugin` v0.11.0. ([#2483](https://github.com/lynx-family/lynx-stack/pull/2483))

## 0.9.1

### Patch Changes

- Support rstest for testing library using a dedicated testing loader. ([#2328](https://github.com/lynx-family/lynx-stack/pull/2328))

- fix(rstest): normalize partial `compat` options in the testing loader ([#2464](https://github.com/lynx-family/lynx-stack/pull/2464))

  The testing loader forwards `compat` directly to `transformReactLynxSync` without normalization. When `compat` is supplied as a partial object, the required `target` field is absent and the WASM transform throws `Error: Missing field 'target'`. Added the same normalization already present in `getCommonOptions` for the background/main-thread loaders: fills in `target: 'MIXED'` and all other required fields with sensible defaults.

- Add `enableUiSourceMap` option to enable UI source map generation and debug-metadata asset emission. ([#2402](https://github.com/lynx-family/lynx-stack/pull/2402))

## 0.9.0

### Minor Changes

- Add `removeCall` for shake function calls. Its initial default value matches the hooks that were previously in `removeCallParams`, and `removeCallParams` now defaults to empty. ([#2423](https://github.com/lynx-family/lynx-stack/pull/2423))

  `removeCall` removes matched runtime hook calls entirely, replacing them with `undefined` in expression positions and dropping them in statement positions. `removeCallParams` keeps the existing behavior of preserving the call while stripping its arguments.

## 0.8.0

### Minor Changes

- feat: add `globalPropsMode` option to `PluginReactLynxOptions` ([#2346](https://github.com/lynx-family/lynx-stack/pull/2346))

  - When configured to `"event"`, `updateGlobalProps` will only trigger a global event and skip the `runWithForce` flow.
  - Defaults to `"reactive"`, which means `updateGlobalProps` will trigger re-render automatically.

### Patch Changes

- Fix sourcemap misalignment when wrapping lazy bundle main-thread chunks. ([#2361](https://github.com/lynx-family/lynx-stack/pull/2361))

  The lazy bundle IIFE wrapper is now injected in `processAssets` at `PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1` by walking chunk groups instead of patching assets in `beforeEncode`.

  - With `experimental_isLazyBundle: true`, the wrapper is applied to lazy-bundle chunk groups.
  - Without lazy bundle mode, the wrapper is applied to async main-thread chunk groups generated by dynamic import.

  Injecting the wrapper in this stage keeps the emitted JS stable after optimization while still running before `DEV_TOOLING` sourcemap finalization, so the generated `.js` and `.js.map` stay aligned.

- Set `__DEV__` and `__PROFILE__` to `true` on `NODE_ENV === 'development'`. ([#2324](https://github.com/lynx-family/lynx-stack/pull/2324))

## 0.7.4

### Patch Changes

- Remove element api calls alog by default, and only enable it when `__ALOG_ELEMENT_API__` is defined to `true` or environment variable `REACT_ALOG_ELEMENT_API` is set to `true`. ([#2192](https://github.com/lynx-family/lynx-stack/pull/2192))

## 0.7.3

### Patch Changes

- Support `@lynx-js/template-webpack-plugin` v0.10.0. ([#1992](https://github.com/lynx-family/lynx-stack/pull/1992))

## 0.7.2

### Patch Changes

- Pass sourcemap generated by rspack to swc transformer. ([#1910](https://github.com/lynx-family/lynx-stack/pull/1910))

- When engineVersion is greater than or equal to 3.1, use `__SetAttribute` to set text attribute for text node instead of creating a raw text node. ([#1880](https://github.com/lynx-family/lynx-stack/pull/1880))

## 0.7.1

### Patch Changes

- Supports `@lynx-js/template-webpack-plugin` 0.9.0. ([#1705](https://github.com/lynx-family/lynx-stack/pull/1705))

## 0.7.0

### Minor Changes

- Remove `@lynx-js/react` from peerDependencies. ([#1711](https://github.com/lynx-family/lynx-stack/pull/1711))

- Add a new required option `workletRuntimePath`. ([#1711](https://github.com/lynx-family/lynx-stack/pull/1711))

## 0.6.20

### Patch Changes

- Updated dependencies [[`aaca8f9`](https://github.com/lynx-family/lynx-stack/commit/aaca8f91d177061c7b0430cc5cb21a3602897534)]:
  - @lynx-js/webpack-runtime-globals@0.0.6

## 0.6.19

### Patch Changes

- Be compat with `@lynx-js/react` v0.112.0 ([#1323](https://github.com/lynx-family/lynx-stack/pull/1323))

- Fix `REACT_PROFILE` not taking effect. ([#1306](https://github.com/lynx-family/lynx-stack/pull/1306))

## 0.6.18

### Patch Changes

- Be compat with `@lynx-js/react` v0.111.0 ([#204](https://github.com/lynx-family/lynx-stack/pull/204))

## 0.6.17

### Patch Changes

- Enable fine-grained control for `output.inlineScripts` ([#883](https://github.com/lynx-family/lynx-stack/pull/883))

  ```ts
  type InlineChunkTestFunction = (params: {
    size: number;
    name: string;
  }) => boolean;

  type InlineChunkTest = RegExp | InlineChunkTestFunction;

  type InlineChunkConfig =
    | boolean
    | InlineChunkTest
    | { enable?: boolean | 'auto'; test: InlineChunkTest };
  ```

  ```ts
  import { defineConfig } from '@lynx-js/rspeedy';

  export default defineConfig({
    output: {
      inlineScripts: ({ name, size }) => {
        return name.includes('foo') && size < 1000;
      },
    },
  });
  ```

## 0.6.16

### Patch Changes

- Supports `@lynx-js/template-webpack-plugin` 0.8.0. ([#1033](https://github.com/lynx-family/lynx-stack/pull/1033))

- Support `@lynx-js/react` v0.110.0. ([#770](https://github.com/lynx-family/lynx-stack/pull/770))

- Keep snapshot id unchanged on Windows. ([#1050](https://github.com/lynx-family/lynx-stack/pull/1050))

- Fix lazy bundle name on Windows. ([#1060](https://github.com/lynx-family/lynx-stack/pull/1060))

## 0.6.15

### Patch Changes

- Fix lazy bundle build failed on Rspeedy v0.9.8 (with `output.iife: true`). ([#972](https://github.com/lynx-family/lynx-stack/pull/972))

## 0.6.14

### Patch Changes

- Support `@lynx-js/template-webpack-plugin` v0.7.0. ([#880](https://github.com/lynx-family/lynx-stack/pull/880))

- Support `@lynx-js/react` v0.109.0. ([#840](https://github.com/lynx-family/lynx-stack/pull/840))

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
