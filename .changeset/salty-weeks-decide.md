---
"@lynx-js/css-extract-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/webpack-runtime-globals": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/rspeedy": patch
---

feat: support lazyCompilation

Lazy compilation is an excellent way to improve dev startup performance.It compiles modules on demand rather than compiling all modules at startup.

example:

```js
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy';
export default defineConfig({
  dev: {
    lazyCompilation: true, // Enable with default settings
    // Or with explicit configuration:
    // lazyCompilation: {
    //   entries: false
    // }
  },
  plugins: [
    pluginReactLynx({
      firstScreenSyncTiming: 'jsReady',
    }),
  ],
});
```

type definition:

```typescript
export type LazyCompilationOptions = {
  /**
   * Enable lazy compilation for entries.
   */
  entries?: boolean;
};
```
