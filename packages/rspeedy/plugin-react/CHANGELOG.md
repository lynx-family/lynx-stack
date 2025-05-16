# @lynx-js/react-rsbuild-plugin

## 0.9.10

### Patch Changes

- Updated dependencies [[`e599635`](https://github.com/lynx-family/lynx-stack/commit/e599635a667c2d98271e0d54b7f6d49dadbfbdba), [`c38c737`](https://github.com/lynx-family/lynx-stack/commit/c38c737096697781a154219d6b1e3b4ffbf6512f), [`d16522e`](https://github.com/lynx-family/lynx-stack/commit/d16522eee0db3cd1a6ec20fb5832fd79f89a2264)]:
  - @lynx-js/template-webpack-plugin@0.6.11
  - @lynx-js/web-webpack-plugin@0.6.7
  - @lynx-js/runtime-wrapper-webpack-plugin@0.1.0
  - @lynx-js/react-alias-rsbuild-plugin@0.9.10
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/react-webpack-plugin@0.6.13
  - @lynx-js/css-extract-webpack-plugin@0.5.3

## 0.9.9

### Patch Changes

- Fix runtime error: "SyntaxError: Identifier 'i' has already been declared". ([#651](https://github.com/lynx-family/lynx-stack/pull/651))

- Enable runtime profiling when `performance.profile` is set to true. ([#722](https://github.com/lynx-family/lynx-stack/pull/722))

- fix: resolve page crash on development mode when enabling `experimental_isLazyBundle: true` ([#653](https://github.com/lynx-family/lynx-stack/pull/653))

- Support `@lynx-js/react` v0.108.0. ([#649](https://github.com/lynx-family/lynx-stack/pull/649))

- Updated dependencies [[`ea4da1a`](https://github.com/lynx-family/lynx-stack/commit/ea4da1af0ff14e2480e49f7004a3a2616594968d), [`ca15dda`](https://github.com/lynx-family/lynx-stack/commit/ca15dda4122c5eedc1fd82cefb0cd9af7fdaa47e), [`f8d369d`](https://github.com/lynx-family/lynx-stack/commit/f8d369ded802f8d7b9b859b1f150015d65773b0f), [`ea4da1a`](https://github.com/lynx-family/lynx-stack/commit/ea4da1af0ff14e2480e49f7004a3a2616594968d)]:
  - @lynx-js/react-webpack-plugin@0.6.13
  - @lynx-js/runtime-wrapper-webpack-plugin@0.0.10
  - @lynx-js/react-alias-rsbuild-plugin@0.9.9
  - @lynx-js/react-refresh-webpack-plugin@0.3.2

## 0.9.8

### Patch Changes

- Support @lynx-js/react v0.107.0 ([#438](https://github.com/lynx-family/lynx-stack/pull/438))

- fix(web): `:root` not work on web platform ([#607](https://github.com/lynx-family/lynx-stack/pull/607))

  Note: To solve this issue, you need to upgrade your `react-rsbuild-plugin`

- Refactor: Replace built-in `background-only` implementation with npm package ([#602](https://github.com/lynx-family/lynx-stack/pull/602))

  Previously we maintained custom files:

  - `empty.ts` for background thread
  - `error.ts` for main thread validation

  Now adopting the standard `background-only` npm package

- fix(web): css selector not work for selectors with combinator and pseudo-class on WEB ([#608](https://github.com/lynx-family/lynx-stack/pull/608))

  like `.parent > :not([hidden]) ~ :not([hidden])`

  you will need to upgrade your `react-rsbuild-plugin` to fix this issue

- Updated dependencies [[`6a5fc80`](https://github.com/lynx-family/lynx-stack/commit/6a5fc80716e668bacf4ce4ff59c569683ace0ba2), [`06bb78a`](https://github.com/lynx-family/lynx-stack/commit/06bb78a6b93d4a7be7177a6269dd4337852ce90d), [`f3afaf6`](https://github.com/lynx-family/lynx-stack/commit/f3afaf6c7919d3fe60ac2dfcd8af77178436f785), [`bf9c685`](https://github.com/lynx-family/lynx-stack/commit/bf9c68501205b038043e2f315e0a690c8bc46829), [`5269cab`](https://github.com/lynx-family/lynx-stack/commit/5269cabef7609159bdd0dd14a03c5da667907424)]:
  - @lynx-js/react-webpack-plugin@0.6.12
  - @lynx-js/web-webpack-plugin@0.6.6
  - @lynx-js/template-webpack-plugin@0.6.10
  - @lynx-js/react-alias-rsbuild-plugin@0.9.8
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/css-extract-webpack-plugin@0.5.3

## 0.9.7

### Patch Changes

- Support overriding SWC configuration. ([#563](https://github.com/lynx-family/lynx-stack/pull/563))

  Now you can override configuration like `useDefineForClassFields` using `tools.swc`.

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    tools: {
      swc: {
        jsc: {
          transform: {
            useDefineForClassFields: true,
          },
        },
      },
    },
  })
  ```

- Updated dependencies [[`f1ca29b`](https://github.com/lynx-family/lynx-stack/commit/f1ca29bd766377dd46583f15e1e75bca447699cd)]:
  - @lynx-js/react-webpack-plugin@0.6.11
  - @lynx-js/react-alias-rsbuild-plugin@0.9.7
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/web-webpack-plugin@0.6.5

## 0.9.6

### Patch Changes

- Updated dependencies [[`ea42e62`](https://github.com/lynx-family/lynx-stack/commit/ea42e62fbcd5c743132c3e6e7c4851770742d544), [`12e3afe`](https://github.com/lynx-family/lynx-stack/commit/12e3afe14fa46bbec817bed48b730798f777543c)]:
  - @lynx-js/web-webpack-plugin@0.6.4
  - @lynx-js/template-webpack-plugin@0.6.9
  - @lynx-js/react-alias-rsbuild-plugin@0.9.6
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/react-webpack-plugin@0.6.10
  - @lynx-js/css-extract-webpack-plugin@0.5.3

## 0.9.5

### Patch Changes

- fix: add enableCSSInvalidation for encodeCSS of css HMR, this will fix pseudo-class (such as `:active`) not working in HMR. ([#435](https://github.com/lynx-family/lynx-stack/pull/435))

- Disable `module.generator.json.JSONParse` option as it increases the bundle size of `main-thread.js`. For more detail, please see this [issue](https://github.com/webpack/webpack/issues/19319). ([#402](https://github.com/lynx-family/lynx-stack/pull/402))

- Updated dependencies [[`3e7988f`](https://github.com/lynx-family/lynx-stack/commit/3e7988f3af4b4f460eaf5add29cca19537dc1a6b), [`7243242`](https://github.com/lynx-family/lynx-stack/commit/7243242801e3a8ca0213c0ef642f69a22c39960e)]:
  - @lynx-js/css-extract-webpack-plugin@0.5.3
  - @lynx-js/template-webpack-plugin@0.6.8
  - @lynx-js/react-alias-rsbuild-plugin@0.9.5
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/react-webpack-plugin@0.6.10
  - @lynx-js/web-webpack-plugin@0.6.3

## 0.9.4

### Patch Changes

- feat: add extractStr option to pluginReactLynx ([#391](https://github.com/lynx-family/lynx-stack/pull/391))

- Convert background-only files from js to ts ([#346](https://github.com/lynx-family/lynx-stack/pull/346))

- Updated dependencies [[`f849117`](https://github.com/lynx-family/lynx-stack/commit/f84911731faa4d0f6373d1202b9b2cabb0bafc48), [`d730101`](https://github.com/lynx-family/lynx-stack/commit/d7301017a383b8825cdc813a649ef26ce1c37641), [`42217c2`](https://github.com/lynx-family/lynx-stack/commit/42217c2c77a33e729977fc7108b218a1cb868e6a), [`f03bd4a`](https://github.com/lynx-family/lynx-stack/commit/f03bd4a62f81902ba55caf10df56447c89743e62)]:
  - @lynx-js/react-webpack-plugin@0.6.10
  - @lynx-js/template-webpack-plugin@0.6.7
  - @lynx-js/react-alias-rsbuild-plugin@0.9.4
  - @lynx-js/react-refresh-webpack-plugin@0.3.2
  - @lynx-js/css-extract-webpack-plugin@0.5.2
  - @lynx-js/web-webpack-plugin@0.6.3

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

  NOTE: This feature is deprecated and will be removed in the future. Use CodeMod instead.

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

- 91c267b: feat: enable auto `publicPath` for environment.web

  In many case, users cannot set a correct `output.assertPrefix` configuration. Typically those chunks will be uploaded after chunk dumped. Developers may be not able to know the url before those chunks are uploaded.

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
