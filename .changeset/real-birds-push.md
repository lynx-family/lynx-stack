---
"@lynx-js/rspeedy": patch
---

Support `resolve.dedupe`.

This is useful when having multiple duplicated packages in the bundle:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  resolve: {
    dedupe: ['tslib'],
  },
});
```
