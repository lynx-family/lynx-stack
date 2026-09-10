# `@lynx-js/vanilla-rsbuild-plugin`

## 0.1.0

### Minor Changes

- **BREAKING CHANGE**: Require `@lynx-js/rspeedy` `^0.17.0` in the plugins that read the build engine config through `Symbol.for('@lynx-js/rsbuild-plugin:config')`, since the engine that ships with `0.16` does not expose it. The plugins that do not touch the engine keep their existing range and add `^0.17.0` to it. ([#3682](https://github.com/lynx-family/lynx-stack/pull/3682))

### Patch Changes

- Declare the build host as an optional peer dependency. `@rsbuild/core` covers a plain Rsbuild build, and `@lynx-js/rspeedy` covers an Rspeedy one, so whichever host is installed is version-checked. ([#3678](https://github.com/lynx-family/lynx-stack/pull/3678))

- Honor `output.distPath.intermediate`. The Lynx build engine now resolves the intermediate directory, so the option is no longer ignored by the plugins that emit a Lynx bundle. ([#3676](https://github.com/lynx-family/lynx-stack/pull/3676))

- Resolve the bundle filename through `getLynxConfig(api).resolveBundleFilename()` instead of reading `output.filename` out of the Rspeedy config. A configured filename is now honored when the plugins are used with Rsbuild directly. ([#3651](https://github.com/lynx-family/lynx-stack/pull/3651))

- Expose `Symbol.for('LynxTemplatePlugin')` from `pluginLynx` instead of from each DSL plugin, so the plugins that tap the template hooks work with the build engine alone. ([#3675](https://github.com/lynx-family/lynx-stack/pull/3675))

- Wrap the background chunk again. The runtime wrapper only matched assets under `.rspeedy/`, so once the intermediate directory moved to `.lynx/` the background chunk shipped without the wrapper and failed on load with `ReferenceError: lynx is not defined`. The wrapper now targets the background asset the plugin emits, wherever the intermediate directory lives. ([#3745](https://github.com/lynx-family/lynx-stack/pull/3745))
- Updated dependencies [[`c21cddd`](https://github.com/lynx-family/lynx-stack/commit/c21cddd0b75290330b6891f041db63ee5b28f492), [`f743e12`](https://github.com/lynx-family/lynx-stack/commit/f743e123e058d8f97720b1ce8c4a3d6601c8f7be), [`5637926`](https://github.com/lynx-family/lynx-stack/commit/5637926c579bac5e9b78a02b982b1110cf4421d4), [`cdceffc`](https://github.com/lynx-family/lynx-stack/commit/cdceffc6f3fb9ac7b5ce1f48b7edb53c7788c057), [`6da3e18`](https://github.com/lynx-family/lynx-stack/commit/6da3e189f58637e14318782c176ed5970b59f75d), [`5637926`](https://github.com/lynx-family/lynx-stack/commit/5637926c579bac5e9b78a02b982b1110cf4421d4), [`eaefef6`](https://github.com/lynx-family/lynx-stack/commit/eaefef64d9874a8236d99b8abe17978d803a02da), [`0be26e9`](https://github.com/lynx-family/lynx-stack/commit/0be26e91d362041d1b0f568d15828d92f0ed2a6d), [`32ba734`](https://github.com/lynx-family/lynx-stack/commit/32ba7347d1733eb4b2e19e95d7b7415ae78e23d2)]:
  - @lynx-js/template-webpack-plugin@0.16.0
  - @lynx-js/runtime-wrapper-webpack-plugin@0.2.4

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @lynx-js/template-webpack-plugin@0.15.2

## 0.0.1

### Patch Changes

- Add `pluginVanillaLynx` for building native and web Vanilla Lynx Element PAPI applications with Rsbuild and Rspeedy. ([#3441](https://github.com/lynx-family/lynx-stack/pull/3441))
- Updated dependencies [[`6cc9624`](https://github.com/lynx-family/lynx-stack/commit/6cc9624fb54dc7f73b6e68e49e2322b8136d3418)]:
  - @lynx-js/template-webpack-plugin@0.15.1
