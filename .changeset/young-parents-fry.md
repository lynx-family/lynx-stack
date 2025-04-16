---
"@lynx-js/react-rsbuild-plugin": patch
---

Support overriding SWC configuration.

Now you can override configuration like `useDefineForClassFields` using `tools.swc`.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        transform: {
          useDefineForClassFields: true,
        },
      },
    },
  },
});
```
