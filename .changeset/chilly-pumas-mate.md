---
"@lynx-js/react": patch
---

Add the `@lynx-js/react/testing-library/plugins` exports, user can use the Vite plugin to configure RLTL now.

```js
import { defineConfig } from 'vitest/config';
import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

export default defineConfig({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
});
```
