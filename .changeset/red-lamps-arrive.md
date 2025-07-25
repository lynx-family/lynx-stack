---
"@lynx-js/react": patch
---

Support rstest for testing library, you can use rstest with RLTL now:

```ts
import { defineConfig, RstestConfig } from '@rstest/core';
import lynxConfig from './lynx.config.js';

export default defineConfig({
  ...lynxConfig as RstestConfig,
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('@lynx-js/react/testing-library/setupFiles/rstest'),
  ],
  globals: true,
});
```
