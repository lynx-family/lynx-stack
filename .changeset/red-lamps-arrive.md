---
"@lynx-js/react": patch
---

Support rstest for testing library, you can use rstest with RLTL now:

```ts
import { defineConfig } from '@rstest/core';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { rstestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    rstestTestingLibraryPlugin(),
    pluginReactLynx({
      enableTestingLibrary: true,
    }),
  ],
  testEnvironment: 'jsdom',
  setupFiles: [
    require.resolve('@lynx-js/react/testing-library/setupFiles/rstest'),
  ],
  globals: true,
});
```
