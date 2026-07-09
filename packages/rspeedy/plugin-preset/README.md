# @lynx-js/preset-rsbuild-plugin

A single Rsbuild plugin that turns a plain Rsbuild project into a Lynx one, so a
Lynx app can be built with the **Rsbuild CLI directly** instead of the Rspeedy
CLI.

## Getting Started

```bash
npm install -D @lynx-js/preset-rsbuild-plugin @rsbuild/core
```

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

import { pluginLynxPreset } from '@lynx-js/preset-rsbuild-plugin'

export default defineConfig({
  plugins: [pluginLynxPreset(), pluginReactLynx()],
  environments: {
    lynx: {},
  },
})
```

Then build and dev with the Rsbuild CLI:

```bash
rsbuild build
rsbuild dev
```

## What it does

`pluginLynxPreset()` bundles everything the Rspeedy CLI applies by default:

- The Lynx internal plugins (chunk loading, resolve, target, swc, minify,
  output, sourcemap, dev/HMR, debug metadata, …).
- The Lynx **config defaults** (e.g. `output.legalComments: 'none'`,
  `output.dataUriLimit`, `dev.writeToDisk`, `splitChunks: false`), applied only
  when you have not set the field yourself.
- The Lynx **forced fields** that would otherwise break the output
  (`tools.htmlPlugin: false`, `output.polyfill: 'off'`, `output.charset`). These
  override your config and warn when you set a conflicting value.

Config validation follows an allow-list: only the fields Lynx actually controls
are managed. Any other Rsbuild field is passed through as-is and is your
responsibility.

## Status

> [!NOTE]
> This package currently consumes the Lynx internal plugins from
> `@lynx-js/rspeedy/internal`. The long-term direction is to move those plugins
> into this package and have the Rspeedy CLI depend on the preset, at which
> point `@lynx-js/rspeedy` becomes an optional convenience CLI on top.
