---
"@lynx-js/config-rsbuild-plugin": patch
---

Init `@lynx-js/config-rsbuild-plugin` for configuring Lynx Configs that are not exposed by DSL plugins.

For example:

```ts
// lynx.config.ts
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginLynxConfig({
      enableCheckExposureOptimize: false,
    }),
  ],
});
```
