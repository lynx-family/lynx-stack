# @lynx-js/rspeedy

## 0.11.5

### Patch Changes

- Bump Rsbuild v1.5.13 with Rspack v1.5.8. ([#1849](https://github.com/lynx-family/lynx-stack/pull/1849))

## 0.11.4

### Patch Changes

- Bump Rsbuild v1.5.12 with Rspack v1.5.7. ([#1708](https://github.com/lynx-family/lynx-stack/pull/1708))

- Fix the "lynx.getJSModule is not a function" error on Web platform ([#1830](https://github.com/lynx-family/lynx-stack/pull/1830))

- Support `server.compress` ([#1799](https://github.com/lynx-family/lynx-stack/pull/1799))

- Support `server.cors` ([#1808](https://github.com/lynx-family/lynx-stack/pull/1808))

## 0.11.3

### Patch Changes

- Use `output.chunkLoading: 'lynx'` for `environments.web`. ([#1737](https://github.com/lynx-family/lynx-stack/pull/1737))

- Support `resolve.extensions` ([#1759](https://github.com/lynx-family/lynx-stack/pull/1759))

- Set the default value of `output.cssModules.localIdentName` to `[local]-[hash:base64:6]`. ([#1783](https://github.com/lynx-family/lynx-stack/pull/1783))

## 0.11.2

### Patch Changes

- Support `server.proxy`. ([#1745](https://github.com/lynx-family/lynx-stack/pull/1745))

- Support `command` and `env` parameters in the function exported by `lynx.config.js`. ([#1669](https://github.com/lynx-family/lynx-stack/pull/1669))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig(({ command, env }) => {
    const isBuild = command === 'build'
    const isTest = env === 'test'

    return {
      output: {
        minify: !isTest,
      },
      performance: {
        buildCache: isBuild,
      },
    }
  })
  ```

- Support `resolve.dedupe`. ([#1671](https://github.com/lynx-family/lynx-stack/pull/1671))

  This is useful when having multiple duplicated packages in the bundle:

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    resolve: {
      dedupe: ['tslib'],
    },
  })
  ```

- Support `resolve.aliasStrategy` for controlling priority between `tsconfig.json` paths and `resolve.alias` ([#1722](https://github.com/lynx-family/lynx-stack/pull/1722))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    resolve: {
      alias: {
        '@': './src',
      },
      // 'prefer-tsconfig' (default): tsconfig.json paths take priority
      // 'prefer-alias': resolve.alias takes priority
      aliasStrategy: 'prefer-alias',
    },
  })
  ```

- Bump Rsbuild v1.5.4 with Rspack v1.5.2. ([#1644](https://github.com/lynx-family/lynx-stack/pull/1644))

- Updated dependencies [[`d7c5da3`](https://github.com/lynx-family/lynx-stack/commit/d7c5da329caddfb12ed77159fb8b1b8f38717cff)]:
  - @lynx-js/chunk-loading-webpack-plugin@0.3.3
  - @lynx-js/cache-events-webpack-plugin@0.0.2

## 0.11.1

### Patch Changes

- Disable lazyCompilation by default. ([#1647](https://github.com/lynx-family/lynx-stack/pull/1647))

- Bump Rsbuild v1.5.2 with Rspack v1.5.1. ([#1624](https://github.com/lynx-family/lynx-stack/pull/1624))

- Add `output.dataUriLimit.*` for fine-grained control of asset inlining. ([#1648](https://github.com/lynx-family/lynx-stack/pull/1648))

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    output: {
      dataUriLimit: {
        image: 5000,
        media: 0,
      },
    },
  })
  ```

## 0.11.0

### Minor Changes

- Deprecate `source.alias`, use `resolve.alias` instead. ([#1610](https://github.com/lynx-family/lynx-stack/pull/1610))

  Note that `resolve.alias` has **lower** priority than the deprecated `source.alias`.

- Bump Rsbuild v1.5.0 with Rspack v1.5.0. ([#1591](https://github.com/lynx-family/lynx-stack/pull/1591))

- **BREAKING CHANGE**: Remove the `./register` exports from `@lynx-js/rspeedy`. ([#1547](https://github.com/lynx-family/lynx-stack/pull/1547))

  This should not affect most users.

### Patch Changes

- Support `resolve.alias`. ([#1610](https://github.com/lynx-family/lynx-stack/pull/1610))

- Support `rspeedy build --watch` ([#1579](https://github.com/lynx-family/lynx-stack/pull/1579))

- Updated dependencies [[`d7d0b9b`](https://github.com/lynx-family/lynx-stack/commit/d7d0b9b94e219cd057c935d723775c82b10559a6), [`1952fc1`](https://github.com/lynx-family/lynx-stack/commit/1952fc1557e5abbdbdf4a2073fd3b6f64dd32c3c)]:
  - @lynx-js/cache-events-webpack-plugin@0.0.2
  - @lynx-js/chunk-loading-webpack-plugin@0.3.2

## 0.10.8

### Patch Changes

- Support caching Lynx native events when chunk splitting is enabled. ([#1370](https://github.com/lynx-family/lynx-stack/pull/1370))

  When `performance.chunkSplit.strategy` is not `all-in-one`, Lynx native events are cached until the BTS chunk is fully loaded and are replayed when that chunk is ready. The `firstScreenSyncTiming` flag will no longer change to `jsReady` anymore.

- Support exporting `Promise` and function in `lynx.config.ts`. ([#1590](https://github.com/lynx-family/lynx-stack/pull/1590))

- Fix missing `publicPath` using when `rspeedy dev --mode production`. ([#1310](https://github.com/lynx-family/lynx-stack/pull/1310))

- Updated dependencies [[`aaca8f9`](https://github.com/lynx-family/lynx-stack/commit/aaca8f91d177061c7b0430cc5cb21a3602897534)]:
  - @lynx-js/cache-events-webpack-plugin@0.0.1
  - @lynx-js/chunk-loading-webpack-plugin@0.3.1

## 0.10.7

### Patch Changes

- `output.inlineScripts` defaults to `false` when chunkSplit strategy is not `'all-in-one'` ([#1504](https://github.com/lynx-family/lynx-stack/pull/1504))

## 0.10.6

### Patch Changes

- Remove the experimental `provider` option. ([#1432](https://github.com/lynx-family/lynx-stack/pull/1432))

- Add `output.filename.wasm` and `output.filename.assets` options. ([#1449](https://github.com/lynx-family/lynx-stack/pull/1449))

- fix deno compatibility ([#1412](https://github.com/lynx-family/lynx-stack/pull/1412))

- Should call the `api.onCloseBuild` hook after the build finished. ([#1446](https://github.com/lynx-family/lynx-stack/pull/1446))

- Bump Rsbuild v1.4.15. ([#1423](https://github.com/lynx-family/lynx-stack/pull/1423))

- Support using function in `output.filename.*`. ([#1449](https://github.com/lynx-family/lynx-stack/pull/1449))

## 0.10.5

### Patch Changes

- Should support using `.js` extensions when loading configuration with Node.js [builtin type stripping](https://nodejs.org/api/typescript.html#type-stripping). ([#1407](https://github.com/lynx-family/lynx-stack/pull/1407))

## 0.10.4

### Patch Changes

- Bump Rsbuild v1.4.12 with Rspack v1.4.11. ([#1326](https://github.com/lynx-family/lynx-stack/pull/1326))

## 0.10.3

### Patch Changes

- Should be able to override `performance.profile` when `DEBUG=rspeedy`. ([#1307](https://github.com/lynx-family/lynx-stack/pull/1307))

## 0.10.2

### Patch Changes

- Bump Rsbuild v1.4.6 with Rspack v1.4.8. ([#1282](https://github.com/lynx-family/lynx-stack/pull/1282))

## 0.10.1

### Patch Changes

- Fix `rspeedy build --mode development` failed. ([#1252](https://github.com/lynx-family/lynx-stack/pull/1252))

- Bump Rsbuild v1.4.5 with Rspack v1.4.5 ([#1239](https://github.com/lynx-family/lynx-stack/pull/1239))

- Updated dependencies [[`0a3c89d`](https://github.com/lynx-family/lynx-stack/commit/0a3c89d5776009d1f32d444e77be834fa2b79645)]:
  - @lynx-js/webpack-dev-transport@0.2.0

## 0.10.0

### Minor Changes

- Bump Rsbuild v1.4.3 with Rspack v1.4.2. ([#1204](https://github.com/lynx-family/lynx-stack/pull/1204))

  See [Announcing Rspack 1.4](https://rspack.rs/blog/announcing-1-4) for more details.

- Deprecated `output.distPath.intermediate` ([#1154](https://github.com/lynx-family/lynx-stack/pull/1154))

  This option is never read and will be removed in the future version.

## 0.9.11

### Patch Changes

- Enable fine-grained control for `output.inlineScripts` ([#883](https://github.com/lynx-family/lynx-stack/pull/883))

  ```ts
  type InlineChunkTestFunction = (params: {
    size: number
    name: string
  }) => boolean

  type InlineChunkTest = RegExp | InlineChunkTestFunction

  type InlineChunkConfig =
    | boolean
    | InlineChunkTest
    | { enable?: boolean | 'auto', test: InlineChunkTest }
  ```

  ```ts
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    output: {
      inlineScripts: ({ name, size }) => {
        return name.includes('foo') && size < 1000
      },
    },
  })
  ```

- docs: remove chunks: 'all' in comments ([#1168](https://github.com/lynx-family/lynx-stack/pull/1168))

## 0.9.10

## 0.9.9

### Patch Changes

- Set `optimization.emitOnErrors` when `DEBUG` is enabled. ([#1000](https://github.com/lynx-family/lynx-stack/pull/1000))

  This is useful for debugging PrimJS Syntax error.

## 0.9.8

### Patch Changes

- Fix the "SyntaxError: invalid redefinition of parameter name" error. ([#949](https://github.com/lynx-family/lynx-stack/pull/949))

  Remove the default `output.iife: false` from Rspack.

## 0.9.7

### Patch Changes

- The default value of `output.inlineScripts` should be `true`. ([#915](https://github.com/lynx-family/lynx-stack/pull/915))

- Updated dependencies [[`c210b79`](https://github.com/lynx-family/lynx-stack/commit/c210b79319cf014c89c2215f5e0940163eccfa1e)]:
  - @lynx-js/chunk-loading-webpack-plugin@0.3.0

## 0.9.6

### Patch Changes

- Support `output.inlineScripts`, which controls whether to inline scripts into Lynx bundle (`.lynx.bundle`). ([#874](https://github.com/lynx-family/lynx-stack/pull/874))

  Only background thread scripts can remain non-inlined, whereas the main thread script is always inlined.

  example:

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    output: {
      inlineScripts: false,
    },
  })
  ```

- Bump Rsbuild v1.3.21 with Rspack v1.3.11. ([#863](https://github.com/lynx-family/lynx-stack/pull/863))

- Updated dependencies [[`5b67bde`](https://github.com/lynx-family/lynx-stack/commit/5b67bde8a7286b9dcc727c9707cf83020bb5abfa)]:
  - @lynx-js/chunk-loading-webpack-plugin@0.2.1

## 0.9.5

### Patch Changes

- Support `source.preEntry`. ([#750](https://github.com/lynx-family/lynx-stack/pull/750))

  Add a script before the entry file of each page. This script will be executed before the page code.
  It can be used to execute global logics, such as injecting polyfills, setting global styles, etc.

  example：

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'
  export default defineConfig({
    source: {
      preEntry: './src/polyfill.ts',
    },
  })
  ```

- Bump Rsbuild v1.3.20 with Rspack v1.3.10. ([#799](https://github.com/lynx-family/lynx-stack/pull/799))

- Add `callerName` option to `createRspeedy`. ([#757](https://github.com/lynx-family/lynx-stack/pull/757))

  It can be accessed by Rsbuild plugins through [`api.context.callerName`](https://rsbuild.dev/api/javascript-api/instance#contextcallername), and execute different logic based on this identifier.

  ```js
  export const myPlugin = {
    name: 'my-plugin',
    setup(api) {
      const { callerName } = api.context

      if (callerName === 'rslib') {
        // ...
      } else if (callerName === 'rspeedy') {
        // ...
      }
    },
  }
  ```

- Support `performance.buildCache`. ([#766](https://github.com/lynx-family/lynx-stack/pull/766))

- Updated dependencies [[`fbc4fbb`](https://github.com/lynx-family/lynx-stack/commit/fbc4fbbdb572ad7128a33dc06e8d8a026d18e388)]:
  - @lynx-js/webpack-dev-transport@0.1.3

## 0.9.4

### Patch Changes

- Bump Rsbuild v1.3.17 with Rspack v1.3.9. ([#708](https://github.com/lynx-family/lynx-stack/pull/708))

- Support `performance.profile`. ([#691](https://github.com/lynx-family/lynx-stack/pull/691))

- Support CLI flag `--mode` to specify the build mode. ([#723](https://github.com/lynx-family/lynx-stack/pull/723))

- Enable native Rsdoctor plugin by default. ([#688](https://github.com/lynx-family/lynx-stack/pull/688))

  Set `tools.rsdoctor.experiments.enableNativePlugin` to `false` to use the old JS plugin.

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    tools: {
      rsdoctor: {
        experiments: {
          enableNativePlugin: false,
        },
      },
    },
  })
  ```

  See [Rsdoctor - 1.0](https://rsdoctor.dev/blog/release/release-note-1_0#-faster-analysis) for more details.

- Bump Rsbuild v1.3.14 with Rspack v1.3.8. ([#630](https://github.com/lynx-family/lynx-stack/pull/630))

## 0.9.3

### Patch Changes

- Bump Rsbuild v1.3.11 with Rspack v1.3.6. ([#594](https://github.com/lynx-family/lynx-stack/pull/594))

## 0.9.2

### Patch Changes

- Support CLI option `--no-env` to disable loading of `.env` files ([#483](https://github.com/lynx-family/lynx-stack/pull/483))

- Bump Rsbuild v1.3.8 with Rspack v1.3.5. ([#579](https://github.com/lynx-family/lynx-stack/pull/579))

## 0.9.1

### Patch Changes

- Bump Rsbuild v1.3.5 with Rspack v1.3.3. ([#467](https://github.com/lynx-family/lynx-stack/pull/467))

## 0.9.0

### Minor Changes

- Bundle Rspeedy with Rslib for faster start-up times. ([#395](https://github.com/lynx-family/lynx-stack/pull/395))

  This would be a **BREAKING CHANGE** for using [global version of Rspeedy](https://lynxjs.org/rspeedy/cli#using-the-global-rspeedy-version).

  Please ensure that you update your globally installed version of Rspeedy:

  ```bash
  npm install --global @lynx-js/rspeedy@latest
  ```

- Bump Rsbuild v1.3.2 with Rspack v1.3.1 ([#446](https://github.com/lynx-family/lynx-stack/pull/446))

- **BREAKING CHANGE**: Added explicit TypeScript peer dependency requirement of 5.1.6 - 5.8.x. ([#480](https://github.com/lynx-family/lynx-stack/pull/480))

  This formalizes the existing TypeScript version requirement in `peerDependencies` (marked as optional since it is only needed for TypeScript configurations). The actual required TypeScript version has not changed.

  Note: This may cause installation to fail if you have strict peer dependency checks enabled.

  Node.js v22.7+ users can bypass TypeScript installation using `--experimental-transform-types` or `--experimental-strip-types` flags. Node.js v23.6+ users don't need any flags. See [Node.js - TypeScript](https://nodejs.org/api/typescript.html) for details.

### Patch Changes

- Support CLI flag `--base` to specify the base path of the server. ([#387](https://github.com/lynx-family/lynx-stack/pull/387))

- Support CLI flag `--environment` to specify the name of environment to build ([#462](https://github.com/lynx-family/lynx-stack/pull/462))

- Select the most appropriate network interface. ([#457](https://github.com/lynx-family/lynx-stack/pull/457))

  This is a port of [webpack/webpack-dev-server#5411](https://github.com/webpack/webpack-dev-server/pull/5411).

- Support Node.js v23.6+ native TypeScript. ([#481](https://github.com/lynx-family/lynx-stack/pull/481))

  See [Node.js - TypeScript](https://nodejs.org/api/typescript.html) for more details.

- Support CLI flag `--env-mode` to specify the env mode to load the `.env.[mode]` file. ([#453](https://github.com/lynx-family/lynx-stack/pull/453))

- Support `dev.hmr` and `dev.liveReload`. ([#458](https://github.com/lynx-family/lynx-stack/pull/458))

- Updated dependencies [[`df63722`](https://github.com/lynx-family/lynx-stack/commit/df637229e8dafda938aba73e10f3c8d95afc7dce), [`df63722`](https://github.com/lynx-family/lynx-stack/commit/df637229e8dafda938aba73e10f3c8d95afc7dce)]:
  - @lynx-js/chunk-loading-webpack-plugin@0.2.0

## 0.8.7

### Patch Changes

- Support using `-debugids` in `output.sourceMap.js`. ([#342](https://github.com/lynx-family/lynx-stack/pull/342))

  See [Source Map Debug ID Proposal](https://github.com/tc39/ecma426/blob/main/proposals/debug-id.md) for more details.

- Use `chunkLoading: 'import-scripts'` for Web platform ([#352](https://github.com/lynx-family/lynx-stack/pull/352))

- Support `output.distPath.*`. ([#366](https://github.com/lynx-family/lynx-stack/pull/366))

  See [Rsbuild - distPath](https://rsbuild.dev/config/output/dist-path) for all available options.

- Support `performance.printFileSize` ([#336](https://github.com/lynx-family/lynx-stack/pull/336))

  Whether to print the file sizes after production build.

## 0.8.6

### Patch Changes

- Support `dev.progressBar` ([#307](https://github.com/lynx-family/lynx-stack/pull/307))

  Whether to display progress bar during compilation.

  Defaults to `true`.

- support load `.env` file by default ([#233](https://github.com/lynx-family/lynx-stack/pull/233))

- Support `server.strictPort` ([#303](https://github.com/lynx-family/lynx-stack/pull/303))

  When a port is occupied, Rspeedy will automatically increment the port number until an available port is found.

  Set strictPort to true and Rspeedy will throw an exception when the port is occupied.

## 0.8.5

### Patch Changes

- Bump Rsdoctor v1.0.0. ([#250](https://github.com/lynx-family/lynx-stack/pull/250))

## 0.8.4

### Patch Changes

- Bump Rsbuild v1.2.19 with Rspack v1.2.8 ([#168](https://github.com/lynx-family/lynx-stack/pull/168))

- Add `mergeRspeedyConfig` function for merging multiple Rspeedy configuration object. ([#169](https://github.com/lynx-family/lynx-stack/pull/169))

- Bump Rsdoctor v1.0.0-rc.0 ([#186](https://github.com/lynx-family/lynx-stack/pull/186))

- Support configure the base path of the server. ([#196](https://github.com/lynx-family/lynx-stack/pull/196))

  By default, the base path of the server is `/`, and users can access lynx bundle through `http://<host>:<port>/main.lynx.bundle`
  If you want to access lynx bundle through `http://<host>:<port>/foo/main.lynx.bundle`, you can change `server.base` to `/foo`

  example:

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'
  export default defineConfig({
    server: {
      base: '/dist',
    },
  })
  ```

- Updated dependencies [[`b026c8b`](https://github.com/lynx-family/lynx-stack/commit/b026c8bdcbf7bdcda73e170477297213b447d876)]:
  - @lynx-js/webpack-dev-transport@0.1.2

## 0.8.3

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Fix error "'wmic' is not recognized as an internal or external command" ([#91](https://github.com/lynx-family/lynx-stack/pull/91))

- Bump Rsbuild v1.2.15 with Rspack v1.2.7. ([#44](https://github.com/lynx-family/lynx-stack/pull/44))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/chunk-loading-webpack-plugin@0.1.7
  - @lynx-js/webpack-dev-transport@0.1.1
  - @lynx-js/websocket@0.0.4

## 0.8.2

### Patch Changes

- 1abf8f0: feat(rspeedy): support generateStatsFile
- 1abf8f0: Bump Rsbuild v1.2.11 with Rspack v1.2.3

## 0.8.1

### Patch Changes

- 2d15b44: fix: default value of output.filename changes to be `[name].[platform].bundle`.
- 2c88797: Disable tree-shaking in development.
- 1472918: Remove `output.minify.jsOptions.exclude`.
- 9da942e: Fix HMR connection lost after restart development server.
- Updated dependencies [9da942e]
  - @lynx-js/webpack-dev-transport@0.1.0

## 0.8.0

### Minor Changes

- 3319e0f: **BREAKING CHANGE**: Use `cssnano` by default.

  We enable CSS minification in v0.7.0 and use Lightning CSS by default.
  But there are cases that Lightning CSS produce CSS that cannot be used in Lynx.

  Now, the default CSS minifier is switched to `cssnano` using `@rsbuild/plugin-css-minimizer`.

  You can switch to other tools by using:

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'
  import {
    CssMinimizerWebpackPlugin,
    pluginCssMinimizer,
  } from '@rsbuild/plugin-css-minimizer'

  export default defineConfig({
    plugins: [
      pluginCssMinimizer({
        pluginOptions: {
          minify: CssMinimizerWebpackPlugin.esbuildMinify,
          minimizerOptions: {
            /** Custom options */
          },
        },
      }),
    ],
  })
  ```

  See [@rsbuild/plugin-css-minimizer](https://github.com/rspack-contrib/rsbuild-plugin-css-minimizer) for details.

- 3319e0f: **BREAKING CHANGE**: Remove `output.minify.cssOptions`.

  You can use custom options with [@rsbuild/plugin-css-minimizer](https://github.com/rspack-contrib/rsbuild-plugin-css-minimizer):

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'
  import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'

  export default defineConfig({
    plugins: [
      pluginCssMinimizer({
        pluginOptions: {
          minimizerOptions: {
            /** Custom options */
          },
        },
      }),
    ],
  })
  ```

## 0.7.1

### Patch Changes

- 58607e4: Correct the handling of `dev.assetPrefix` to ensure it accurately reflects the `server.port` when the specified port is already in use.

## 0.7.0

### Minor Changes

- e2e23e2: Deprecated `output.filename.template`, use `output.filename.bundle` instead.
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

- 525554c: **BREAKING CHANGE**: Bump ts-blank-space to ^0.6.0.

  Drop support for legacy module namespaces, see [microsoft/TypeScript#51825](https://github.com/microsoft/TypeScript/issues/51825) for details.

### Patch Changes

- 59bba00: Bump Rsbuild v1.2.7 with Rspack v1.2.3.
- a589e2e: Add `output.minify.css` and `output.minify.cssOptions`.
- 6de1176: feat(rspeedy/core): Introduce `source.assetsInclude` to allow the inclusion of additional files to be processed as static assets

## 0.6.0

### Minor Changes

- 2f5c499: Bump Rsbuild v1.2.4 with Rspack v1.2.2

### Patch Changes

- 5ead4b8: Support `type: 'reload-server'` in `dev.watchFiles`.

  - The default `type: 'reload-page'` will reload the Lynx page when it detects changes in the specified files.
  - The new `type: 'reload-server'` will restart the development server when it detects changes in the specified files.

  ```js
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    dev: {
      watchFiles: [
        {
          type: 'reload-server',
          paths: ['public/**/*.txt'],
        },
        {
          type: 'reload-page',
          paths: ['public/**/*.json'],
        },
      ],
    },
  })
  ```

- be9b003: Add `source.exclude`.
- 2643477: Add `performance.removeConsole`.

## 0.5.10

### Patch Changes

- Updated dependencies [65ecd41]
  - @lynx-js/chunk-loading-webpack-plugin@0.1.6

## 0.5.9

### Patch Changes

- cb337de: Add `source.decorators`.

  You may use `source.decorators.version: '2022-03'` for using Stage 3 decorator proposal.

  Or use `source.decorators.version: 'legacy'` for using TypeScript's `experimentalDecorators: true`.

  See [How does this proposal compare to other versions of decorators?](https://github.com/tc39/proposal-decorators?tab=readme-ov-file#how-does-this-proposal-compare-to-other-versions-of-decorators) for details.

  - @lynx-js/chunk-loading-webpack-plugin@0.1.5

## 0.5.8

### Patch Changes

- 30096c9: Exclude minify for `template.js` of lazy bundle to avoid build error.
- Updated dependencies [0067512]
  - @lynx-js/chunk-loading-webpack-plugin@0.1.4

## 0.5.7

### Patch Changes

- 80a892c: Bump Rsbuild v1.1.13.

## 0.5.6

### Patch Changes

- ee6ed69: Bump Rsbuild v1.1.12 with Rspack v1.1.8.
- 8f91e6c: Add `exit` to plugin api.

## 0.5.5

### Patch Changes

- 9279ce1: Bump Rsbuild v1.1.10 with Rspack v1.1.6.
