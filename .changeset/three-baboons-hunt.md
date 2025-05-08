---
"@lynx-js/rspeedy": patch
---

Enable native Rsdoctor plugin by default.

Set `tools.rsdoctor.experiments.enableNativePlugin` to `false` to use the old JS plugin.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    rsdoctor: {
      experiments: {
        enableNativePlugin: false,
      },
    },
  },
});
```

See [Rsdoctor - 1.0](https://rsdoctor.dev/blog/release/release-note-1_0#-faster-analysis) for more details.
