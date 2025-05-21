---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Support `output.inlineScripts`, which controls whether to inline scripts into Lynx bundle (`.lynx.bundle`).

Only background thread scripts can remain non-inlined, whereas the main thread script is always inlined.

example:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    inlineScripts: false,
  },
});
```
