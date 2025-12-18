---
"@lynx-js/externals-loading-webpack-plugin": patch
---

Introduce `@lynx-js/externals-loading-webpack-plugin`.

```js
// webpack.config.js
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin';

export default {
  plugins: [
    new ExternalsLoadingPlugin({
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
