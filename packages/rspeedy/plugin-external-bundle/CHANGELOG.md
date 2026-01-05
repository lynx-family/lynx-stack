# @lynx-js/external-bundle-rsbuild-plugin

## 0.0.1

### Patch Changes

- Introduce `@lynx-js/external-bundle-rsbuild-plugin`. ([#2006](https://github.com/lynx-family/lynx-stack/pull/2006))

  ```ts
  // lynx.config.ts
  import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

  export default {
    plugins: [
      pluginReactLynx(),
      pluginExternalBundle({
        externals: {
          lodash: {
            url: 'http://lodash.lynx.bundle',
            background: { sectionPath: 'background' },
            mainThread: { sectionPath: 'mainThread' },
          },
        },
      }),
    ],
  }
  ```

- Updated dependencies [[`491c5ef`](https://github.com/lynx-family/lynx-stack/commit/491c5efac23e3c99914fb9270d0476aa5c0207f9)]:
  - @lynx-js/externals-loading-webpack-plugin@0.0.2
