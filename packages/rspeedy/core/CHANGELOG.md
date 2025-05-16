# @lynx-js/rspeedy

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
