---
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Allow customization of the react$ alias.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  resolve: {
    alias: {
      react$: '@lynx-js/react/compat',
    },
  },
});
```
