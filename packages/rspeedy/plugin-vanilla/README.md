# `@lynx-js/vanilla-rsbuild-plugin`

An Rsbuild plugin for building Vanilla Lynx applications directly with Element PAPI.

## Usage with Rspeedy

```ts
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVanillaLynx } from '@lynx-js/vanilla-rsbuild-plugin'

export default defineConfig({
  plugins: [
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

For a convention-based entry, `source.entry` points to the main-thread source:

```ts
export default defineConfig({
  source: {
    entry: {
      card: './src/card/main-thread.ts',
    },
  },
  plugins: [pluginVanillaLynx()],
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

When Rspeedy configures both `web` and `lynx` environments, the plugin emits a web-encoded `[name].web.bundle` and a native `[name].lynx.bundle`. Background JavaScript is runtime-wrapped only for native Lynx; the web encoder embeds the unwrapped background chunk for the web runtime.

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

When `bundleFilename` is omitted, the plugin uses Rspeedy's `output.filename.bundle`. Outside Rspeedy it defaults to `[name].[platform].bundle`.
