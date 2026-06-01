# @lynx-js/config-rsbuild-plugin

## 0.0.3

### Patch Changes

- Widen the `@lynx-js/rspeedy` peer dependency range to include `^0.15.0`. ([#2701](https://github.com/lynx-family/lynx-stack/pull/2701))

- Add @lynx-js/rspeedy@0.15.0 to peer dependencies. ([#2603](https://github.com/lynx-family/lynx-stack/pull/2603))

- Widen peer ranges to admit the new minor versions of `@lynx-js/template-webpack-plugin` (^0.12.0) and `@lynx-js/rspeedy` (^0.15.0) shipping with the unified `debug-metadata.json` feature. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

## 0.0.2

### Patch Changes

- Support `@lynx-js/rspeedy` 0.14.0. ([#2431](https://github.com/lynx-family/lynx-stack/pull/2431))

## 0.0.1

### Patch Changes

- Init `@lynx-js/config-rsbuild-plugin` for configuring Lynx Configs that are not exposed by DSL plugins. ([#2052](https://github.com/lynx-family/lynx-stack/pull/2052))

  For example:

  ```ts
  // lynx.config.ts
  import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'
  import { defineConfig } from '@lynx-js/rspeedy'

  export default defineConfig({
    plugins: [
      pluginLynxConfig({
        enableCheckExposureOptimize: false,
      }),
    ],
  })
  ```
