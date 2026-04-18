---
"@lynx-js/rspeedy": patch
---

add a `sourceMap.css` option to emit CSS sourcemaps.

By default, `sourceMap.css` is false. You can set it to true to emit CSS sourcemaps.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    sourceMap: {
      css: true,
    },
  },
});
```
