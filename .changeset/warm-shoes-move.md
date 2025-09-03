---
"@lynx-js/rspeedy": patch
---

Add `output.dataUriLimit.*` for fine-grained control of asset inlining.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    dataUriLimit: {
      image: 5000,
      media: 0,
    },
  },
});
```
