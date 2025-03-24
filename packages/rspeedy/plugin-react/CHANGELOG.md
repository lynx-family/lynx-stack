# @lynx-js/react-rsbuild-plugin

## 0.9.3

### Patch Changes

- Support `@lynx-js/react` v0.106.0. ([#239](https://github.com/lynx-family/lynx-stack/pull/239))

- Fix the issue where the canary version of React was not included in the `rule.include` configuration. ([#275](https://github.com/lynx-family/lynx-stack/pull/275))

- Updated dependencies [[`ba26a4d`](https://github.com/lynx-family/lynx-stack/commit/ba26a4db1ec3dcfd445dd834533b3bc10b091686), [`462e97b`](https://github.com/lynx-family/lynx-stack/commit/462e97b28c12b554c0c825c7df453bdf433749ae), [`aa1fbed`](https://github.com/lynx-family/lynx-stack/commit/aa1fbedec8459f8c830467a5b92033e3530dce80), [`d2d55ef`](https://github.com/lynx-family/lynx-stack/commit/d2d55ef9fe438c35921d9db0daa40d5228822ecc), [`6af0396`](https://github.com/lynx-family/lynx-stack/commit/6af039661844f22b65ad1b98db5c7b31df204ae4)]:
  - @lynx-js/template-webpack-plugin@0.6.6
  - @lynx-js/react-webpack-plugin@0.6.9
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.9
  - @lynx-js/web-webpack-plugin@0.6.3
  - @lynx-js/react-alias-rsbuild-plugin@0.9.3
  - @lynx-js/css-extract-webpack-plugin@0.5.2
  - @lynx-js/react-refresh-webpack-plugin@0.3.2

## 0.9.2

### Patch Changes

- Avoid entry IIFE in `main-thread.js` ([#206](https://github.com/lynx-family/lynx-stack/pull/206))

- Enable CSS minification for scoped CSS. ([#205](https://github.com/lynx-family/lynx-stack/pull/205))

- Should generate `.rspeedy/[name]/main-thread.js` instead of `.rspeedy/[name]__main-thread/main-thread.js` ([#180](https://github.com/lynx-family/lynx-stack/pull/180))

- Updated dependencies [[`984a51e`](https://github.com/lynx-family/lynx-stack/commit/984a51e62a42b7f3d2670189f722f0d51f9fce9b), [`5e01cef`](https://github.com/lynx-family/lynx-stack/commit/5e01cef366a20d48b430b11eedbf9e5141f316a2), [`315ba3b`](https://github.com/lynx-family/lynx-stack/commit/315ba3b7fac7872884edcdd5ef3e6d6230bbe115), [`315ba3b`](https://github.com/lynx-family/lynx-stack/commit/315ba3b7fac7872884edcdd5ef3e6d6230bbe115)]:
  - @lynx-js/css-extract-webpack-plugin@0.5.2
  - @lynx-js/react-webpack-plugin@0.6.8
  - @lynx-js/template-webpack-plugin@0.6.5
  - @lynx-js/react-alias-rsbuild-plugin@0.9.2
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/web-webpack-plugin@0.6.2

## 0.9.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- fix(rspeedy/plugin-react): mkdir main:background fails in windows ([#76](https://github.com/lynx-family/lynx-stack/pull/76))

- fix(rspeedy/plugin-react): use path.posix.join for backgroundName to ensure consistent path separators across platforms. ([#122](https://github.com/lynx-family/lynx-stack/pull/122))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb), [`870106f`](https://github.com/lynx-family/lynx-stack/commit/870106fcb00d54a9f952be14c9bdcc592099863c), [`ea82ef6`](https://github.com/lynx-family/lynx-stack/commit/ea82ef63e367c6bb87e4205b6014cc5e1f6896a2)]:
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.8
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/css-extract-webpack-plugin@0.5.1
  - @lynx-js/template-webpack-plugin@0.6.4
  - @lynx-js/react-webpack-plugin@0.6.7
  - @lynx-js/react-alias-rsbuild-plugin@0.9.1
  - @lynx-js/web-webpack-plugin@0.6.2

## 0.9.0

### Minor Changes

- 1abf8f0: The `targetSdkVersion` has been deprecated. Please use `engineVersion` instead, as `targetSdkVersion` is now an alias for `engineVersion`.

### Patch Changes

- 1abf8f0: feat: pass options to CssExtractPlugin
- 1abf8f0: Be compat with `@lynx-js/react` v0.105.0
- 1abf8f0: Set the default `targetSdkVersion` to 3.2.
- Updated dependencies [1abf8f0]
- Updated dependencies [1abf8f0]
- Updated dependencies [1abf8f0]
- Updated dependencies [1abf8f0]
- Updated dependencies [1abf8f0]
- Updated dependencies [1abf8f0]
  - @lynx-js/template-webpack-plugin@0.6.3
  - @lynx-js/react-webpack-plugin@0.6.6
  - @lynx-js/css-extract-webpack-plugin@0.5.0
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.7
  - @lynx-js/web-webpack-plugin@0.6.1
  - @lynx-js/react-alias-rsbuild-plugin@0.9.0
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.8.1

### Patch Changes

- Updated dependencies [1472918]
  - @lynx-js/template-webpack-plugin@0.6.2
  - @lynx-js/react-alias-rsbuild-plugin@0.8.1
  - @lynx-js/react-refresh-webpack-plugin@0.3.1
  - @lynx-js/react-webpack-plugin@0.6.5
  - @lynx-js/css-extract-webpack-plugin@0.4.1
  - @lynx-js/web-webpack-plugin@0.6.1

## 0.8.0

### Minor Changes

- 19cc25b: feat: support [platform] for output.filename, the value is either `environment.lynx` or `environment.web`, the default value of output.filename now is `[name].[platform].bundle`.

### Patch Changes

- 94419fb: Support `@lynx-js/react` v0.104.0
- ad49fb1: Support CSS HMR for ReactLynx
- Updated dependencies [94419fb]
- Updated dependencies [ad49fb1]
- Updated dependencies [1bf9271]
- Updated dependencies [1407bac]
- Updated dependencies [fb4e383]
  - @lynx-js/react-webpack-plugin@0.6.5
  - @lynx-js/css-extract-webpack-plugin@0.4.1
  - @lynx-js/template-webpack-plugin@0.6.1
  - @lynx-js/web-webpack-plugin@0.6.1
  - @lynx-js/react-alias-rsbuild-plugin@0.8.0
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.7.0

### Minor Changes

- e2e23e2: **BREAKING CHANGE**: Change the default `output.filename` to `[name].lynx.bundle`.
- a589e2e: **BREAKING CHANGE**: Enable CSS minification by default.

  You may turn it off using `output.minify.css: false`:

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    output: {
      minify: {
        css: false,
      },
    },
  })
  ```

  Or you may use [@rsbuild/plugin-css-minimizer](https://github.com/rspack-contrib/rsbuild-plugin-css-minimizer) to use `cssnano` as CSS minimizer.

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'
  import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'

  export default defineConfig({
    plugins: [pluginCssMinimizer()],
  })
  ```

### Patch Changes

- b3dc20c: Avoid splitting main-thread chunks.
- Updated dependencies [0d3b44c]
- Updated dependencies [0d3b44c]
- Updated dependencies [a217b02]
- Updated dependencies [227823b]
- Updated dependencies [a217b02]
- Updated dependencies [0d3b44c]
- Updated dependencies [74e0ea3]
  - @lynx-js/web-webpack-plugin@0.6.0
  - @lynx-js/css-extract-webpack-plugin@0.4.0
  - @lynx-js/react-webpack-plugin@0.6.4
  - @lynx-js/template-webpack-plugin@0.6.0
  - @lynx-js/react-alias-rsbuild-plugin@0.7.0
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.6.5

### Patch Changes

- 3ca4c67: Add `enableICU` to the options of pluginReactLynx, and change the default value to `false`.
- Updated dependencies [d156485]
- Updated dependencies [3ca4c67]
- Updated dependencies [d156485]
- Updated dependencies [e406d69]
  - @lynx-js/template-webpack-plugin@0.5.7
  - @lynx-js/web-webpack-plugin@0.5.0
  - @lynx-js/css-extract-webpack-plugin@0.3.0
  - @lynx-js/react-webpack-plugin@0.6.3
  - @lynx-js/react-alias-rsbuild-plugin@0.6.5
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.6.4

### Patch Changes

- 74f2ad2: Fix missing source content in `background.js.map`.
- Updated dependencies [26258c7]
- Updated dependencies [65ecd41]
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.6
  - @lynx-js/react-webpack-plugin@0.6.3
  - @lynx-js/react-alias-rsbuild-plugin@0.6.4
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.6.3

### Patch Changes

- 7b84edf: feat(web): introduce new output chunk format
- 39efd7c: Change `enableRemoveCSSScope` defaults from `undefined` to `true`, now `enableRemoveCSSScope` can be:

  - `true` (by default): All CSS files are treated as global CSS.
  - `false`: All CSS files are treated as scoped CSS, and only take effect in the component that explicitly imports it.
  - `undefined`: Only use scoped CSS for CSS Modules, and treat other CSS files as global CSS. Scoped CSS is faster than global CSS, thus you can use CSS Modules to speedy up your CSS if there are performance issues.

- f1d6095: Add `pipelineSchedulerConfig` option.
- Updated dependencies [39efd7c]
- Updated dependencies [a2f8bad]
- Updated dependencies [3bf5830]
- Updated dependencies [7b84edf]
- Updated dependencies [f1d6095]
  - @lynx-js/template-webpack-plugin@0.5.6
  - @lynx-js/react-webpack-plugin@0.6.2
  - @lynx-js/web-webpack-plugin@0.4.0
  - @lynx-js/react-alias-rsbuild-plugin@0.6.3
  - @lynx-js/react-refresh-webpack-plugin@0.3.1
  - @lynx-js/css-extract-webpack-plugin@0.3.0
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.5

## 0.6.2

### Patch Changes

- e8039f2: Add `defineDCE` in plugin options. Often used to define custom macros.

  ```js
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        defineDCE: {
          __SOME_FALSE_DEFINE__: 'false',
        },
      }),
    ],
  })
  ```

  Different from `define` provided by bundlers like webpack, `defineDCE` works at transform time and a extra DCE (Dead Code Elimination) pass will be performed.

  For example, `import` initialized by dead code will be removed:

  ```js
  import { foo } from 'bar'

  if (__SOME_FALSE_DEFINE__) {
    foo()
    console.log('dead code')
  } else {
    console.log('reachable code')
  }
  ```

  will be transformed to:

  ```js
  console.log('reachable code')
  ```

- Updated dependencies [8dd6cca]
- Updated dependencies [e8039f2]
  - @lynx-js/template-webpack-plugin@0.5.5
  - @lynx-js/react-webpack-plugin@0.6.1
  - @lynx-js/css-extract-webpack-plugin@0.3.0
  - @lynx-js/web-webpack-plugin@0.3.1
  - @lynx-js/react-alias-rsbuild-plugin@0.6.2
  - @lynx-js/react-refresh-webpack-plugin@0.3.1

## 0.6.1

### Patch Changes

- 958efda: feat(web): bundle background.js into main-thread.js for web

  To enable this feature:

  1. set the performance.chunkSplit.strategy to `all-in-one`
  2. use the `mode:'production'` to build

  The output will be only one file.

- 958efda: fix(web): do not set publicPath to auto for all-in-one chunk
- Updated dependencies [958efda]
- Updated dependencies [89248b7]
- Updated dependencies [bf9ec8c]
  - @lynx-js/web-webpack-plugin@0.3.1
  - @lynx-js/template-webpack-plugin@0.5.4
  - @lynx-js/react-alias-rsbuild-plugin@0.6.1
  - @lynx-js/react-refresh-webpack-plugin@0.3.1
  - @lynx-js/react-webpack-plugin@0.6.0
  - @lynx-js/css-extract-webpack-plugin@0.3.0

## 0.6.0

### Minor Changes

- a30c83d: Add `compat.removeComponentAttrRegex`.

  ```js
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        compat: {
          removeComponentAttrRegex: 'YOUR REGEX',
        },
      }),
    ],
  })
  ```

  NOTE: This feature is deprecated and will be removed in the future. Use codemod instead.

- 5f8d492: **BREAKING CHANGE**: Require `@lynx-js/react` v0.103.0.
- 5f8d492: Deprecate `compat.simplifyCtorLikeReactLynx2`

### Patch Changes

- 36f8e4c: Add `enableAccessibilityElement`.
- b37e3d9: Enforced build-time errors for importing `background-only` modules in the `main-thread`.

  - use `import 'background-only'` to mark a module as restricted to the background environment. Any attempt to import such a module in the main thread will result in a build-time error.

    For example:

    ```javascript
    // bar.ts
    import 'background-only'

    export const bar = () => {
      return 'bar'
    }
    ```

    If `bar` is called in `main-thread`, build time error will be triggered.

    > 'background-only' cannot be imported from a main-thread module.

    ```tsx
    // App.tsx
    import { bar } from './bar.js'

    function App() {
      bar()
      return (
        <view>
          <text>Hello, Lynx x rspeedy</text>
        </view>
      )
    }
    ```

  - Additionally, rspeedy now supports `stats.modulesSpace`, which provides detailed dependency tracing to pinpoint the exact file or dependency causing the error.
    ```
    @ ./src/bar.ts
    @ ./src/App.tsx
    @ ./src/index.tsx
    ```

- Updated dependencies [36f8e4c]
- Updated dependencies [a30c83d]
- Updated dependencies [5f8d492]
- Updated dependencies [84cbdfe]
- Updated dependencies [a30c83d]
- Updated dependencies [5f8d492]
- Updated dependencies [5f8d492]
  - @lynx-js/template-webpack-plugin@0.5.3
  - @lynx-js/react-webpack-plugin@0.6.0
  - @lynx-js/react-refresh-webpack-plugin@0.3.1
  - @lynx-js/css-extract-webpack-plugin@0.3.0
  - @lynx-js/web-webpack-plugin@0.3.0
  - @lynx-js/react-alias-rsbuild-plugin@0.6.0

## 0.5.2

### Patch Changes

- e3be842: Support `@lynx-js/react` v0.102.0
- 21dba89: Add `options.shake` to allow custom package names to be shaken.
- Updated dependencies [e3be842]
- Updated dependencies [92fc11e]
- Updated dependencies [21dba89]
- Updated dependencies [a3c39d6]
- Updated dependencies [828e688]
  - @lynx-js/react-webpack-plugin@0.5.2
  - @lynx-js/web-webpack-plugin@0.3.0
  - @lynx-js/react-alias-rsbuild-plugin@0.5.2
  - @lynx-js/react-refresh-webpack-plugin@0.3.0

## 0.5.1

### Patch Changes

- 6730c58: Support `@lynx-js/react` v0.101.0
- Updated dependencies [6730c58]
- Updated dependencies [6730c58]
- Updated dependencies [00ab1ef]
- Updated dependencies [649b978]
- Updated dependencies [63f40cc]
- Updated dependencies [2077e5e]
- Updated dependencies [f5913e5]
  - @lynx-js/react-webpack-plugin@0.5.1
  - @lynx-js/web-webpack-plugin@0.2.1
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.4
  - @lynx-js/react-alias-rsbuild-plugin@0.5.1
  - @lynx-js/react-refresh-webpack-plugin@0.3.0
  - @lynx-js/template-webpack-plugin@0.5.2
  - @lynx-js/css-extract-webpack-plugin@0.3.0

## 0.5.0

### Minor Changes

- 91c267b: feat: enable auto publicpath for environment.web

  In many case, users cannot set a correct assertprefix configuration. Typically those chunks will be uploaded after chunk dumped. Developers may be not able to know the url before those chunks are uploaded.

  In this commit, we allow webpack to infer the correct public path by the import.meta.url.

- 587a782: **BRAKING CHANGE**: Require `@lynx-js/react` v0.100.0

### Patch Changes

- 267c935: feat: upgrade web-webpack-plugin
- 4ef9d17: Move alias to a standalone plugin.
- 1938bb1: Make peerDependencies of `@lynx-js/react` optional.
- Updated dependencies [be5d731]
- Updated dependencies [47cb40c]
- Updated dependencies [ec189ad]
- Updated dependencies [3fae00a]
- Updated dependencies [667593b]
- Updated dependencies [1938bb1]
- Updated dependencies [15a9a34]
- Updated dependencies [587a782]
- Updated dependencies [4ef9d17]
- Updated dependencies [1938bb1]
- Updated dependencies [f022c94]
- Updated dependencies [587a782]
- Updated dependencies [267c935]
- Updated dependencies [5099d89]
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.3
  - @lynx-js/web-webpack-plugin@0.2.0
  - @lynx-js/css-extract-webpack-plugin@0.3.0
  - @lynx-js/react-webpack-plugin@0.5.0
  - @lynx-js/react-alias-rsbuild-plugin@0.5.0
  - @lynx-js/react-refresh-webpack-plugin@0.3.0
