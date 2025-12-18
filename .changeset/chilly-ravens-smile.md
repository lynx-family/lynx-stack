---
"@lynx-js/externals-loading-webpack-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
---

Introduce `@lynx-js/externals-loading-webpack-plugin`. It will help you to load externals built by `@lynx-js/lynx-bundle-rslib-config`.

```js
// webpack.config.js
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';

export default {
  plugins: [
    new ExternalsLoadingPlugin({
      mainThreadChunks: ['index__main-thread'],
      backgroundChunks: ['index'],
      mainThreadLayer: 'main-thread',
      backgroundLayer: 'background',
      externals: {
        lodash: {
          url: 'http://lodash.lynx.bundle',
          background: { sectionPath: 'background' },
          mainThread: { sectionPath: 'main-thread' },
        },
      },
    }),
  ],
};
```
