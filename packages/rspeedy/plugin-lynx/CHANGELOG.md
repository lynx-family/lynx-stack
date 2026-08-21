# @lynx-js/rsbuild-plugin

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
