---
"@lynx-js/rspeedy": patch
---

Support `resolve.aliasStrategy` for controlling priority between `tsconfig.json` paths and `resolve.alias`

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
    },
    // 'prefer-tsconfig' (default): tsconfig.json paths take priority
    // 'prefer-alias': resolve.alias takes priority
    aliasStrategy: 'prefer-alias',
  },
});
```
