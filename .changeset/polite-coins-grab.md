---
"@lynx-js/web-platform-rsbuild-plugin": patch
"@lynx-js/web-worker-runtime": patch
---

feat: add `napiModulesPath` to bundle napiModules into worker runtime.

Usage:

```ts
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  plugins: [pluginWebPlatform({
    // replace with your actual napi-modules file path
    napiModulesPath: path.resolve(__dirname, './index.napi-modules.ts'),
  })],
});
```

`napi-modules.ts` example:

```ts
// index.napi-modules.ts
export default {
  custom_module: function(NapiModules, NapiModulesCall) {
    return {
      async test(name) {
        console.log('CustomModule', NapiModules, NapiModulesCall);
      },
    };
  },
};
```
