# Vanilla Element PAPI

This example renders a counter directly with Element PAPI, `@lynx-js/lynx-runtime` (`/mts` and `/bts`), and TypeScript, without ReactLynx, JSX, or a virtual DOM. A `tap` event starts on the main thread, increments the counter on the background thread, and sends the new value back for the main thread to render.

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

The config uses `pluginLynx()` from `@lynx-js/rsbuild-plugin`. The single
`source.entry.main` calls the matching thread's setup function using
`__MAIN_THREAD__` and `__BACKGROUND__`. The setup modules register listeners
when called.

The development server rebuilds on source changes. Reload the page in its host after a rebuild; direct thread entries do not install an HMR or live-reload runtime.

The example explicitly enables `enableEventHandleRefactor` through `pluginLynxConfig` for its Element PAPI listeners. The entry builder does not set page configuration flags.
