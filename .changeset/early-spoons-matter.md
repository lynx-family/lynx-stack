---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react": patch
---

Support `tools.swc.jsc.transform.verbatimModuleSyntax`.

Currently, the default value is `false`.
It is recommended to set to `true` to get more accurate result.

Additionally, SWC is now configured to preserve side-effect-only imports (e.g., `import './path'`) even when no variables are used from the module. Unused named imports will be transformed into side-effect-only imports instead of being removed, allowing subsequent tools like Rspack to handle final tree-shaking.

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
