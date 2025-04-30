---
"@lynx-js/web-platform-rsbuild-plugin": minor
---

feat: add new parameter `nativeModulesPath` to `pluginWebPlatform({})`.

After this commit, you can use `nativeModulesPath` to package custom nativeModules directly into the worker, and no longer need to pass `nativeModulesMap` to lynx-view.

Here is an example:

- `native-modules.ts`:

```ts
// index.native-modules.ts
export default {
  CustomModule: function(NativeModules, NativeModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NativeModulesCall('getColor', data);
        callback(color);
      },
    };
  },
};
```

- plugin config:

```ts
// rsbuild.config.ts
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  plugins: [pluginWebPlatform({
    // replace with your actual native-modules file path
    nativeModulesPath: path.resolve(__dirname, './index.native-modules.ts'),
  })],
});
```
