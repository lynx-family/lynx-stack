# @lynx-js/rsbuild-plugin

A single Rsbuild plugin that turns a plain Rsbuild project into a Lynx one, so a
Lynx app can be built with the **Rsbuild CLI directly** instead of the Rspeedy
CLI.

## Getting Started

```bash
npm install -D @lynx-js/rsbuild-plugin @rsbuild/core
```

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'

export default defineConfig({
  plugins: [pluginLynx(), pluginReactLynx()],
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

`pluginLynx()` bundles everything the Rspeedy CLI applies by default:

- The Lynx internal plugins (chunk loading, resolve, target, swc, minify,
  output, sourcemap, dev/HMR, debug metadata, …).
- The Lynx **config defaults** (e.g. `output.legalComments: 'none'`,
  `output.dataUriLimit`, `dev.writeToDisk`, `splitChunks: false`), applied only
  when you have not set the field yourself.
- The Lynx **forced fields** that would otherwise break the output
  (`tools.htmlPlugin: false`, `output.polyfill: 'off'`, `output.charset`). These
  override your config and warn when you set a conflicting value.

`pluginLynx()` takes no options. Build configuration is written in
`rsbuild.config.ts` with plain Rsbuild fields; DSL-specific options belong to
the DSL plugins (e.g. `pluginReactLynx`). Only the fields Lynx actually
controls are managed; any other Rsbuild field is passed through as-is.

## Status

> [!NOTE]
> This package **owns** the Lynx build engine: the internal plugins live
> here and are exposed via `@lynx-js/rsbuild-plugin/internal`.
> `@lynx-js/rspeedy` is a thin CLI shell on top: it keeps the `lynx.config.ts`
> schema (`Config`) and composes these plugins to produce byte-identical
> output. The two share that `/internal` contract, so they are expected to move
> in lockstep. This is an experimental direction under evaluation.
