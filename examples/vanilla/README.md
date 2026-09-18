# Vanilla Element PAPI

This example renders a counter directly with Element PAPI and TypeScript, without ReactLynx, JSX, or a virtual DOM. A `tap` event starts on the main thread, increments the counter on the background thread, and sends the new value back for the main thread to render.

## Run

From the repository root:

```bash
pnpm --filter @lynx-js/example-vanilla dev
```

To build the bundle:

```bash
pnpm --filter @lynx-js/example-vanilla build
```

The build targets the `web` and `lynx` environments.

The config uses `pluginVanillaLynx()` from `@lynx-js/vanilla-rsbuild-plugin`. Its `source.entry` points directly to `main-thread.ts`; the plugin discovers the sibling `background.ts` and `style.css` files automatically.
