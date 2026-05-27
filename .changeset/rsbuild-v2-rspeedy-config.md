---
"@lynx-js/rspeedy": minor
---

**BREAKING CHANGE**

[Rsbuild v2](https://rsbuild.rs/guide/upgrade/v1-to-v2) deprecated `performance.chunkSplit`, so configure chunk splitting with Rspeedy's top-level `splitChunks` option instead. Rspeedy still accepts the old `performance.chunkSplit` shape as a deprecated compatibility path, but new configs should migrate:

```diff
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
-  performance: {
-    chunkSplit: {
-      strategy: 'single-vendor',
-    },
-  },
+  splitChunks: {
+    preset: 'single-vendor',
+  },
});
```

Move aliases from `source.alias` to `resolve.alias`:

```diff
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
-  source: {
-    alias: {
-      '@': './src',
-    },
-  },
+  resolve: {
+    alias: {
+      '@': './src',
+    },
+  },
});
```
