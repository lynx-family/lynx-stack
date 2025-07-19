---
"@lynx-js/react": patch
---

Remove the `@lynx-js/react/testing-library/vitest-config` exports, user should replace it with the new `vitestTestingLibraryPlugin` in `vitest.config.js`:

```diff
-  import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config' 
+  import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins'
```
