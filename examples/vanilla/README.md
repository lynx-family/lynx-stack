# Vanilla Element PAPI

This example renders a counter directly with Element PAPI and TypeScript, without ReactLynx, JSX, or a virtual DOM. A `tap` event starts on the main thread, increments the counter on the background thread, and sends the new value back for the main thread to render.

## Performance evaluation

An early [PerformanceObserver](https://lynxjs.org/zh/api/lynx-api/performance-api/performance-observer.html)
listens for `pipeline` entries and displays two categories:

- Initial rendering: [LoadBundleEntry](https://lynxjs.org/zh/api/lynx-api/performance-api/performance-entry/load-bundle-entry.html)
  `lynxFcp` duration
- Update rendering: [PipelineEntry](https://lynxjs.org/zh/api/lynx-api/performance-api/performance-entry/pipeline-entry.html)
  measures each explicitly started update from `pipelineStart` to `pipelineEnd`

Tap **Click me** to measure one update pipeline. Each update uses a unique
timing flag and forwards its generated pipeline options to the Element PAPI
flush. Full entries remain on the background thread; only formatted summaries
are sent to the main thread.

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
