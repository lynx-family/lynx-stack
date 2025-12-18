---
'@lynx-js/external-bundle-rsbuild-plugin': patch
---

Introduce `@lynx-js/external-bundle-rsbuild-plugin`.

```ts
// lynx.config.ts
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default {
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externals: {
        lodash: {
          url: 'http://lodash.lynx.bundle',
          background: { sectionPath: 'background' },
          mainThread: { sectionPath: 'mainThread' },
        },
      },
    }),
  ],
};
```
