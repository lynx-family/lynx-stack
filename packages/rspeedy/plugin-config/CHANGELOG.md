# @lynx-js/config-rsbuild-plugin

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
