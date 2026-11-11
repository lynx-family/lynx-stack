# @lynx-js/rsbuild-plugin

An Rsbuild plugin for building Lynx apps.

## Usage

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'

export default defineConfig({
  plugins: [pluginLynx()],
})
```

## Polyfills

Polyfills are off by default. To inject them on demand, install `core-js` in
your application and set `output.polyfill` to `'usage'`. The `'entry'` mode
is also supported and requires an explicit `core-js` import. Lynx builds use
Chrome 92 as an approximation for selecting polyfills; verify API availability
for the Lynx runtimes you support.
