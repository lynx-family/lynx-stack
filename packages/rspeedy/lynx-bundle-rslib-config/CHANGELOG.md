# @lynx-js/lynx-bundle-rslib-config

## 0.0.1

### Patch Changes

- Add `@lynx-js/lynx-bundle-rslib-config` for bundling Lynx bundle with [Rslib](https://rslib.rs/): ([#1943](https://github.com/lynx-family/lynx-stack/pull/1943))

  ```js
  // rslib.config.js
  import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'

  export default defineExternalBundleRslibConfig({
    id: 'utils-lib',
    source: {
      entry: {
        utils: './src/utils.ts',
      },
    },
  })
  ```
