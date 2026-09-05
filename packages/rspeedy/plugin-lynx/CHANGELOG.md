# @lynx-js/rsbuild-plugin

## 0.1.1

### Patch Changes

- Build an external bundle without a DSL plugin using `pluginLynx` alone. It now registers the runtime wrapper and the encoder a bundle needs to be loadable, and `defineExternalBundleRslibConfig` falls back to its own exported `LAYERS` when no DSL exposes them. ([#3814](https://github.com/lynx-family/lynx-stack/pull/3814))

## 0.1.0

### Minor Changes

- **BREAKING CHANGE**: Remove `dev.client`. `websocketTransport` predates `LynxWebSocketModule`, the native module Lynx has shipped since 2.16, so HMR always resolves `@lynx-js/websocket` — the binding to it. ([#3684](https://github.com/lynx-family/lynx-stack/pull/3684))

- Add `performance` to the `pluginLynx` options, alongside `output`, and expose it on the config `pluginLynx` provides. Rspeedy maps its `performance.profile` onto it, so a plugin can read the option from the build engine instead of requiring Rspeedy to be the caller. `pluginReactLynx` reads it from there instead of requiring Rspeedy. ([#3691](https://github.com/lynx-family/lynx-stack/pull/3691))

- **BREAKING CHANGE**: Emit the intermediate files into `.lynx` instead of `.rspeedy`, since the directory is written by the Lynx build engine rather than by Rspeedy. The directory is no longer configurable: `output.distPath.intermediate` was documented as never read, and nothing else reads it now either. ([#3682](https://github.com/lynx-family/lynx-stack/pull/3682))

### Patch Changes

- Do not apply the Lynx build engine again when `pluginLynx` is registered on an environment rather than globally, which silently replaced the options it was given. ([#3695](https://github.com/lynx-family/lynx-stack/pull/3695))

- Enable `output.sourceMap.css` by default only in Lynx environments, so web builds no longer emit unused CSS `.map` files into the intermediate directory. ([#3747](https://github.com/lynx-family/lynx-stack/pull/3747))

- Accept `DEBUG=lynx` (and `lynx:*`, `lynx:template`) for the Lynx debug output and intermediates. It is the recommended form now that the plugins also run under Rslib and Rsbuild; `DEBUG=rspeedy` keeps working. ([#3735](https://github.com/lynx-family/lynx-stack/pull/3735))

- Honor `output.filename.css`, `output.distPath.css`, `output.legalComments`, `output.sourceMap.js` and `dev.assetPrefix` when they are set on an environment. `pluginLynx` used to read them from the root of the config only and silently replaced a per-environment value with its own default. ([#3768](https://github.com/lynx-family/lynx-stack/pull/3768))

- Declare the build host as an optional peer dependency. `@rsbuild/core` covers a plain Rsbuild build, and `@lynx-js/rspeedy` covers an Rspeedy one, so whichever host is installed is version-checked. ([#3678](https://github.com/lynx-family/lynx-stack/pull/3678))

- Add `pluginLynx({ output: { minify } })` for the per-thread minifier options. They are merged on top of the ones Rspeedy tunnels through the Rsbuild config, and the Lynx options take precedence. ([#3662](https://github.com/lynx-family/lynx-stack/pull/3662))

- Honor `output.distPath.intermediate`. The Lynx build engine now resolves the intermediate directory, so the option is no longer ignored by the plugins that emit a Lynx bundle. ([#3676](https://github.com/lynx-family/lynx-stack/pull/3676))

- Write the bundle to disk during `dev` by default. A Lynx client reads it from disk as often as it reads it from the dev server, so the Lynx build engine now carries the default that only Rspeedy used to apply. ([#3680](https://github.com/lynx-family/lynx-stack/pull/3680))

- Add `pluginLynx({ dev: { client: { websocketTransport } } })` for the module that provides the `WebSocket` used by HMR. It takes precedence over the one Rspeedy tunnels through the Rsbuild config. ([#3663](https://github.com/lynx-family/lynx-stack/pull/3663))

- Stop `rspeedy preview` from repeating the bundle path in the URLs it prints. The bundle path is now resolved once, in `server.printUrls`, instead of being written into the server routes that Rsbuild appends to every printed URL. ([#3779](https://github.com/lynx-family/lynx-stack/pull/3779))

- The minify options come from `pluginLynx` now; `output.minify` only decides whether to minify at all. `pluginLynx` applies them per environment, so `output.minify: true` on an environment no longer drops them (part of #3723). ([#3731](https://github.com/lynx-family/lynx-stack/pull/3731))

- Apply the Lynx build engine to `rslib` builds: module resolution, SWC transforms, bundler target, output, minification (JS and CSS), source maps and debug metadata now match an application build. The plugins that load or serve a bundle stay off, since `rslib` assembles its own. ([#3696](https://github.com/lynx-family/lynx-stack/pull/3696))

- `pluginReactLynx` registers the encoders and the background runtime wrapper for every caller, and `WebEncodePlugin` routes the custom sections of a bundle without a root into the slots the web runtime reads. `@lynx-js/lynx-bundle-rslib-config` only sets the template plugin and the main-thread wrapper up now. ([#3744](https://github.com/lynx-family/lynx-stack/pull/3744))

- Print the dev and preview server URLs from each environment's own entries and `dev.assetPrefix`, instead of crossing the root `source.entry`/`dev.assetPrefix` with every environment. ([#3461](https://github.com/lynx-family/lynx-stack/pull/3461))

- Expose `Symbol.for('LynxTemplatePlugin')` from `pluginLynx` instead of from each DSL plugin, so the plugins that tap the template hooks work with the build engine alone. ([#3675](https://github.com/lynx-family/lynx-stack/pull/3675))
- Updated dependencies [[`d716bd9`](https://github.com/lynx-family/lynx-stack/commit/d716bd9b5520e1b92be22f529ac8fd56197c7466), [`c21cddd`](https://github.com/lynx-family/lynx-stack/commit/c21cddd0b75290330b6891f041db63ee5b28f492), [`f743e12`](https://github.com/lynx-family/lynx-stack/commit/f743e123e058d8f97720b1ce8c4a3d6601c8f7be), [`cdceffc`](https://github.com/lynx-family/lynx-stack/commit/cdceffc6f3fb9ac7b5ce1f48b7edb53c7788c057), [`6da3e18`](https://github.com/lynx-family/lynx-stack/commit/6da3e189f58637e14318782c176ed5970b59f75d), [`754ed35`](https://github.com/lynx-family/lynx-stack/commit/754ed35f8063c9333b75a7a7bbb264cb19c5cc51), [`5637926`](https://github.com/lynx-family/lynx-stack/commit/5637926c579bac5e9b78a02b982b1110cf4421d4), [`eaefef6`](https://github.com/lynx-family/lynx-stack/commit/eaefef64d9874a8236d99b8abe17978d803a02da), [`c21cddd`](https://github.com/lynx-family/lynx-stack/commit/c21cddd0b75290330b6891f041db63ee5b28f492), [`0be26e9`](https://github.com/lynx-family/lynx-stack/commit/0be26e91d362041d1b0f568d15828d92f0ed2a6d), [`32ba734`](https://github.com/lynx-family/lynx-stack/commit/32ba7347d1733eb4b2e19e95d7b7415ae78e23d2)]:
  - @lynx-js/cache-events-webpack-plugin@0.2.1
  - @lynx-js/template-webpack-plugin@0.16.0
  - @lynx-js/debug-metadata-rsbuild-plugin@0.2.2
  - @lynx-js/web-rsbuild-server-middleware@0.26.0
  - @lynx-js/chunk-loading-webpack-plugin@0.4.2

## 0.0.3

### Patch Changes

- Move the debug metadata plugin from `@lynx-js/rspeedy` into `pluginLynx`. ([#3596](https://github.com/lynx-family/lynx-stack/pull/3596))

- Move `pluginDev` into `pluginLynx()`. ([#3364](https://github.com/lynx-family/lynx-stack/pull/3364))

- Move the cssnano-based CSS minimizer into `pluginLynx()`. ([#3364](https://github.com/lynx-family/lynx-stack/pull/3364))

- Move the `tools.htmlPlugin` default into `pluginLynx()`. ([#3364](https://github.com/lynx-family/lynx-stack/pull/3364))

- Move the `output.legalComments` default into `pluginLynx()`. ([#3364](https://github.com/lynx-family/lynx-stack/pull/3364))

- Add `PLUGIN_LYNX_NAME` so plugins can tell whether `pluginLynx` is applied. ([#3576](https://github.com/lynx-family/lynx-stack/pull/3576))

- Alias `@rspack/core/hot/log.js` and `@rspack/core/hot/log-apply-result.js`, which `@lynx-js/webpack-dev-transport` imports without declaring `@rspack/core`. Development builds failed to resolve them on any package manager that does not hoist `@rspack/core`, such as npm and Yarn. ([#3577](https://github.com/lynx-family/lynx-stack/pull/3577))
- Updated dependencies []:
  - @lynx-js/web-rsbuild-server-middleware@0.25.0

## 0.0.2

### Patch Changes

- Move `pluginOutput` and `pluginMinify` into `pluginLynx()`. ([#3391](https://github.com/lynx-family/lynx-stack/pull/3391))

## 0.0.1

### Patch Changes

- Initial release. ([#3283](https://github.com/lynx-family/lynx-stack/pull/3283))

- Move `pluginChunkLoading`, `pluginOptimization`, `pluginResolve`, `pluginSourcemap`, `pluginSwc`, and `pluginTarget` into `pluginLynx()`. `@lynx-js/rspeedy` now depends on `@lynx-js/rsbuild-plugin`. ([#3301](https://github.com/lynx-family/lynx-stack/pull/3301))
