---
"@lynx-js/chunk-loading-webpack-plugin": minor
---

**BREAKING CHANGE**: Remove the deprecated `ChunkLoadingRspackPlugin`, use `ChunkLoadingWebpackPlugin` with `output.chunkLoading: 'lynx'` instead.

```js
import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';

export default {
  output: {
    chunkLoading: 'lynx',
  },
  plugins: [
    new ChunkLoadingWebpackPlugin(),
  ],
};
```
