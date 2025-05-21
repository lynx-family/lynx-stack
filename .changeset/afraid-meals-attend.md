---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Support `output.inlineScripts`, which controls whether to inline scripts files when LynxEncodePlugin generates the manifest file.

example:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    inlineScripts: false,
  },
});
```
