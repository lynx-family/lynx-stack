---
"@lynx-js/lynx-bundle-rslib-config": patch
---

Add `@lynx-js/lynx-bundle-rslib-config` for bundling Lynx bundle with [Rslib](https://rslib.rs/):

```js
// rslib.config.js
import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';

export default defineExternalBundleRslibConfig({
  id: 'utils-lib',
  source: {
    entry: {
      utils: './src/utils.ts',
    },
  },
});
```
