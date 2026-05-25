---
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/rspeedy": minor
---

Support a function form for `output.filename.bundle`.

`output.filename.bundle` now accepts a function `(context: { lazyBundle: boolean; entryName?: string; platform: string }) => string` in addition to a string. The function is called once for the main bundle (`lazyBundle: false`) and once for the lazy bundles (`lazyBundle: true`), so a single config can control both the main bundle filename and the lazy bundle filename — without a dedicated `lazyBundle` field or a custom plugin.

```js
import { execSync } from 'node:child_process'

import { defineConfig } from '@lynx-js/rspeedy'

const gitHash = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  output: {
    filename: {
      bundle: ({ lazyBundle, platform }) =>
        lazyBundle
          ? `my-lazy-bundles/[name].[fullhash]-${gitHash}.bundle`
          : `[name].${platform}.bundle`,
    },
  },
})
```
