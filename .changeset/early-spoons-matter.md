---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react": patch
---

Support `tools.swc.jsc.transform.verbatimModuleSyntax`.

Currently, the default value is `false`.
It is recommended to set to `true` to get more accurate result.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        transform: {
          verbatimModuleSyntax: true,
        },
      },
    },
  },
});
```
