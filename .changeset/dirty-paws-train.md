---
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Use `@upupming/type-config` for Lynx configuration types. Now you can configure Lynx configurations with type safety and autocompletion in `pluginReactLynx`.

```js
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  plugins: [
    pluginReactLynx({
      debugInfoOutside: false,
      enableICU: true,
      pipelineSchedulerConfig: 65535,
      /// ...any options supported by `@upupming/type-config`
    }),
  ],
});
```
