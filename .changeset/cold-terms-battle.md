---
"@lynx-js/rspeedy": patch
---

Support `source.preEntry`.

Add a script before the entry file of each page. This script will be executed before the page code.
It can be used to execute global logics, such as injecting polyfills, setting global styles, etc.

example：

```js
import { defineConfig } from '@lynx-js/rspeedy';
export default defineConfig({
  source: {
    preEntry: './src/polyfill.ts',
  },
});
```
