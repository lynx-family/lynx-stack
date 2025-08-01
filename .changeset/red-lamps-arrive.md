---
"@lynx-js/react": patch
---

Support rstest for testing library, you can use rstest with RLTL now:

Create a config file `rstest.config.ts` with the following content:

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

And then use rstest as usual:

```bash
$ rstest
```

For more usage detail, see https://rstest.rs/
