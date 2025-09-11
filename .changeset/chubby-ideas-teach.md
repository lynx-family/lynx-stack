---
"@lynx-js/rspeedy": patch
---

Support `command` and `env` parameters in the function exported by `lynx.config.js`.

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig(({ command, env }) => {
  const isBuild = command === 'build';
  const isTest = env === 'test';

  return {
    output: {
      minify: !isTest,
    },
    performance: {
      buildCache: isBuild,
    },
  };
});
```
