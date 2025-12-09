---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Support lynx environment variant `lynx-` and `web-`.

Enhanced environments detection to support Lynx variants by matching both the `lynx-` `web-` prefix and the exact `lynx` `web` string. This enables users to utilize different Lynx configurations for multiple build outputs.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  environments: {
    lynx: {
      output: {
        distPath: { root: 'dist/default' },
      },
    },
    'lynx-foo': {
      output: {
        distPath: { root: 'dist/foo' },
        minify: false,
      },
    },
    web: {
      output: {
        distPath: { root: 'dist/web' },
      },
    },
    'web-foo': {
      output: {
        distPath: { root: 'dist/web-foo' },
        minify: false,
      },
    },
  },
});
```
