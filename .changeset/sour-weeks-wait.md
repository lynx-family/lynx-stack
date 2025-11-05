---
"@lynx-js/react-rsbuild-plugin": patch
---

Add `react-compiler-runtime` to `resolve.dedupe`.

With this change you can setup [React Compiler](https://react.dev/learn/react-compiler) for ReactLynx by `pluginBabel`:

```js
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginBabel } from '@rsbuild/plugin-babel';

export default defineConfig({
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions(opts) {
        opts.plugins?.unshift([
          'babel-plugin-react-compiler',
          // See https://react.dev/reference/react-compiler/configuration for config
          {
            // ReactLynx only supports target to version 17
            target: '17',
          },
        ]);
      },
    }),
  ],
});
```
