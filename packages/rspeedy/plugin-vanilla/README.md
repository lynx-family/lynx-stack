# `@lynx-js/vanilla-rsbuild-plugin`

An Rsbuild plugin for building Vanilla Lynx applications directly with Element PAPI.

## Usage

```ts
// rsbuild.config.ts
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import { pluginVanillaLynx } from '@lynx-js/vanilla-rsbuild-plugin'
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  environments: { lynx: {} },
  plugins: [
    pluginLynx(),
    pluginVanillaLynx({
      entries: {
        card: {
          mainThread: './src/card/main-thread.ts',
          background: './src/card/background.ts',
          css: './src/card/style.css',
        },
      },
    }),
  ],
})
```

With Rspeedy, add only `pluginVanillaLynx()` to `lynx.config.ts`; Rspeedy applies `pluginLynx` itself.

For a convention-based entry, `source.entry` points to the main-thread source:

```ts
export default defineConfig({
  environments: { lynx: {} },
  source: {
    entry: {
      card: './src/card/main-thread.ts',
    },
  },
  plugins: [pluginLynx(), pluginVanillaLynx()],
})
```

The plugin discovers these optional sibling files:

```text
src/card/
  main-thread.ts
  background.ts
  style.css
```

`background.ts` runs in the background JavaScript thread. Element PAPI tree creation and mutation must stay in `main-thread.ts`.

Use an explicit `entries` item when the two thread sources are in different directories. Set `background: false` for a main-thread-only card. Explicit entries take precedence over `source.entry`.

Entry sources are module requests and use Rspeedy or Rsbuild resolution,
including aliases and configured extensions. Automatic sibling discovery is a
filesystem convention: it runs only when `mainThread` names an existing local
file. When `mainThread` is an alias or package request, configure `background`
and `css` explicitly when they are needed.

The plugin emits one `.bundle` per logical entry, marks the main-thread asset for Lepus encoding, wraps only the native background asset, and enables the event-handler config required by Element PAPI listeners. HMR and live reload are disabled because Vanilla Lynx does not currently install a compatible hot-update runtime.

When both `web` and `lynx` environments are configured, the plugin emits a web-encoded `[name].web.bundle` and a native `[name].lynx.bundle`. Background JavaScript is runtime-wrapped only for native Lynx; the web encoder embeds the unwrapped background chunk for the web runtime.

## Options

```ts
pluginVanillaLynx({
  entries: {
    card: {
      mainThread: './src/card/main-thread.ts',
      background: './src/card/background.ts',
    },
  },
  engineVersion: '3.5',
  bundleFilename: '[name].bundle',
})
```

When `bundleFilename` is omitted, `pluginLynx`'s `output.filename.bundle` is used (default `'[name].[platform].bundle'`).
