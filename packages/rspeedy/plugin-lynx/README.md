# @lynx-js/rsbuild-plugin

An Rsbuild plugin for building Lynx apps.

## Usage

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'

export default defineConfig({
  plugins: [pluginLynx()],
  environments: { lynx: {} },
})
```
