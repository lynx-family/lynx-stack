---
"@lynx-js/rspeedy": minor
---

Support Rsbuild 2 and Rspack 2 in Rspeedy, deprecate removed Rsbuild config aliases, and document how to migrate the affected options.

Move aliases from `source.alias` to `resolve.alias`:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
```
