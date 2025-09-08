---
"@lynx-js/react": patch
---

Support testing React Compiler in testing library. Enable React Compiler by setting the `experimental_enableReactCompiler` option of `createVitestConfig` to `true`.

```js
import { defineConfig, mergeConfig } from 'vitest/config';
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';

const defaultConfig = await createVitestConfig({
  runtimePkgName: '@lynx-js/react',
  experimental_enableReactCompiler: true,
});

export default mergeConfig(defaultConfig, config);
```
