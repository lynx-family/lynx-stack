---
"@lynx-js/rspeedy": patch
---

Respect custom SWC target configuration in `lynx.config.js`, such as:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        target: 'es5',
      },
    },
  },
});
```
