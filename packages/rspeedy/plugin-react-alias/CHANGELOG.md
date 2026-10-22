# @lynx-js/react-alias-rsbuild-plugin

## 0.21.0

### Minor Changes

- Deliver the main-thread runtime through named imports from its init entry, including background-only definitions that carry their registration dependencies into the main-thread graph. Runtime code participates in business defines and release processing. Every supported transform supplies semantic runtime requirements, including for definitions injected from background-only modules; watch rebuilds refresh their dependencies and metadata. ([#4066](https://github.com/lynx-family/lynx-stack/pull/4066))

  Upgrade the build plugins and `@lynx-js/react` together. This release requires `@lynx-js/react@^0.128.0`; its runtime and bundled transform use the same module-delivery protocol. The refresh plugin adds support for `@lynx-js/react-webpack-plugin@^0.13.0` while retaining its existing supported versions. Older compiler output is unsupported. The prebuilt worklet-runtime chunk, its package entries, and `loadWorkletRuntime` are removed. Combined lazy chunks share their paired main runtime, and standalone lazy bundles bootstrap themselves.

  The worklet init entry follows `worklet.runtimePkg`: remove a trailing `/internal`, if present, and append `/worklet-runtime/init`. Its `registerWorklet` export uses the existing host registration function when the runtime is already initialized. Default worklet options use `@lynx-js/react/internal` for helpers.

  Testing-library initializes module-delivered worklets on its emulated main thread in Vitest and Rstest.

### Patch Changes

- Add the `@lynx-js/react/worklet-runtime/init` entry and resolve it to the published, unbundled runtime module in normal and lazy builds. The entry uses the existing runtime initialization guard, so loading it again preserves the runtime and its registrations. ([#4065](https://github.com/lynx-family/lynx-stack/pull/4065))

  Existing compiler output continues to use the legacy runtime-loading path.
- Preserve the original TypeScript sources from published React runtime source maps when bundling the runtime on both the main and background threads. Main and lazy output maps retain runtime and worklet locations alongside per-chunk release metadata. ([#4160](https://github.com/lynx-family/lynx-stack/pull/4160))

## 0.20.4

No changes in this release.

## 0.20.3

### Patch Changes

- Add `@lynx-js/rspeedy` `^0.18.0` to the peer dependency range. ([#3971](https://github.com/lynx-family/lynx-stack/pull/3971))

## 0.20.2

## 0.20.1

## 0.20.0

### Patch Changes

- Declare the build host as an optional peer dependency. `@rsbuild/core` covers a plain Rsbuild build, and `@lynx-js/rspeedy` covers an Rspeedy one, so whichever host is installed is version-checked. ([#3678](https://github.com/lynx-family/lynx-stack/pull/3678))

- **BREAKING CHANGE**: Require `@lynx-js/rspeedy` `^0.17.0` in the plugins that read the build engine config through `Symbol.for('@lynx-js/rsbuild-plugin:config')`, since the engine that ships with `0.16` does not expose it. The plugins that do not touch the engine keep their existing range and add `^0.17.0` to it. ([#3682](https://github.com/lynx-family/lynx-stack/pull/3682))

## 0.19.1

## 0.19.0

### Patch Changes

- Apply ReactLynx aliases to every generated bundler chain so repeated Rsbuild config initialization, including Rstest, retains the plugin's resolve configuration. ([#3501](https://github.com/lynx-family/lynx-stack/pull/3501))

- Add `@lynx-js/react-signals`, a thread-aware Preact Signals adapter that keeps Signals dependencies out of `@lynx-js/react`. Signal reactivity runs on the background thread, while main-thread rendering uses static signal values with inactive setters, subscriptions, and effects. ([#3346](https://github.com/lynx-family/lynx-stack/pull/3346))

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- Fix `Cannot find module '@lynx-js/react/jsx-runtime'` when a stray Yarn PnP manifest (`.pnp.cjs`) exists in an ancestor directory of an npm/pnpm project. Yarn PnP resolution is now only enabled when the build actually runs under the PnP runtime. ([#2920](https://github.com/lynx-family/lynx-stack/pull/2920))

## 0.17.2

### Patch Changes

- Support enabling preact devtools in production via the `REACT_DEVTOOL` environment variable. ([#2880](https://github.com/lynx-family/lynx-stack/pull/2880))

  By default `@lynx-js/preact-devtools` is aliased away in production builds. Setting the `REACT_DEVTOOL` environment variable now:

  1. keeps a user-imported `@lynx-js/preact-devtools` from being stripped;
  2. defines `__REACT_DEVTOOL__`, which gates the dev-only runtime hooks devtools depends on (such as `injectLepusMethods`) so they also run in production;
  3. keeps function/class names during minification (`keep_fnames`/`keep_classnames`), which devtools needs to resolve component names (`type.name`) and to reconstruct the hook tree (it matches minified stack frames by function name).

  `@lynx-js/react/debug` remains development-only.

## 0.17.1

## 0.17.0

## 0.16.3

## 0.16.2

## 0.16.1

## 0.16.0

### Minor Changes

- Simplify hooks for main-thread runtime, which only can run during the first screen. ([#2441](https://github.com/lynx-family/lynx-stack/pull/2441))

### Patch Changes

- fix(rstest): add global fallback aliases for `@lynx-js/react/jsx-runtime` and `@lynx-js/react/jsx-dev-runtime` ([#2464](https://github.com/lynx-family/lynx-stack/pull/2464))

  `pluginReactAlias` only aliased these entries inside layer-specific rules (`issuerLayer: BACKGROUND/MAIN_THREAD`). In rstest mode there are no layers, so JSX transformed by the testing loader—which emits `import { jsx } from '@lynx-js/react/jsx-runtime'`—could not be resolved, causing a `Cannot find module '@lynx-js/react/jsx-runtime'` error. Added global (non-layer-specific) fallback aliases pointing to the background jsx-runtime.

## 0.15.0

## 0.14.0

## 0.13.0

## 0.12.10

## 0.12.9

## 0.12.8

## 0.12.7

## 0.12.6

## 0.12.5

## 0.12.4

## 0.12.3

## 0.12.2

## 0.12.1

## 0.12.0

### Minor Changes

- **BREAKING CHANGE**: Use resolver from Rspack. ([#1964](https://github.com/lynx-family/lynx-stack/pull/1964))

  The `createLazyResolver` now requires an `rspack` parameter:

  ```diff
  - function createLazyResolver(directory: string, conditionNames: string[]): (request: string) => Promise<string>;
  + function createLazyResolver(rspack: rspack, directory: string, conditionNames: string[]): (request: string) => Promise<string>;
  ```

### Patch Changes

- Support Yarn Plug'n'Play. ([#1964](https://github.com/lynx-family/lynx-stack/pull/1964))

## 0.11.4

## 0.11.3

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.14

### Patch Changes

- Allow customization of the react$ alias. ([#1653](https://github.com/lynx-family/lynx-stack/pull/1653))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    resolve: {
      alias: {
        react$: '@lynx-js/react/compat',
      },
    },
  })
  ```

## 0.10.13

### Patch Changes

- Support using multiple times in different environments. ([#1498](https://github.com/lynx-family/lynx-stack/pull/1498))

- Alias `@lynx-js/preact-devtools` to `false` to reduce an import of empty webpack module. ([#1593](https://github.com/lynx-family/lynx-stack/pull/1593))

## 0.10.12

## 0.10.11

### Patch Changes

- Fix the `Package subpath './compat' is not defined by "exports"` error. ([#1460](https://github.com/lynx-family/lynx-stack/pull/1460))

## 0.10.10

## 0.10.9

### Patch Changes

- Add alias for `@lynx-js/react/compat`. ([#1316](https://github.com/lynx-family/lynx-stack/pull/1316))

## 0.10.8

### Patch Changes

- Support `@lynx-js/react/debug`. ([#1250](https://github.com/lynx-family/lynx-stack/pull/1250))

## 0.10.7

## 0.10.6

## 0.10.5

## 0.10.4

### Patch Changes

- Replace `enhanced-resolve` with `unrs-resolver` ([#936](https://github.com/lynx-family/lynx-stack/pull/936))

## 0.10.3

## 0.10.2

### Patch Changes

- Resolve runtime packages in parallel using `Promise.all`. ([#955](https://github.com/lynx-family/lynx-stack/pull/955))

## 0.10.1

## 0.10.0

## 0.9.10

## 0.9.9

## 0.9.8

### Patch Changes

- Refactor: Replace built-in `background-only` implementation with npm package ([#602](https://github.com/lynx-family/lynx-stack/pull/602))

  Previously we maintained custom files:

  - `empty.ts` for background thread
  - `error.ts` for main thread validation

  Now adopting the standard `background-only` npm package

## 0.9.7

## 0.9.6

## 0.9.5

## 0.9.4

## 0.9.3

### Patch Changes

- Fix the issue where the canary version of React was not included in the `rule.include` configuration. ([#275](https://github.com/lynx-family/lynx-stack/pull/275))

## 0.9.2

## 0.9.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.9.0

## 0.8.1

## 0.8.0

## 0.7.0

## 0.6.5

## 0.6.4

## 0.6.3

## 0.6.2

## 0.6.1

## 0.6.0

## 0.5.2

## 0.5.1

### Patch Changes

- 2077e5e: Ensure only alias once for different version of alias plugins

## 0.5.0

### Patch Changes

- 15a9a34: Ensure alias only applied once.
- 4ef9d17: Move alias to a standalone plugin.
