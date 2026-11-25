# Vanilla Element PAPI

This example renders a counter directly with Element PAPI, with TypeScript and LynXML entries. The TypeScript entry uses `@lynx-js/lynx-runtime` (`/mts` and `/bts`); the LynXML entry is a self-contained file using native `lynx` APIs. A `tap` event starts on the main thread, increments the counter on the background thread, and sends the new value back for the main thread to render.

## Run

From the repository root:

```bash
pnpm --filter @lynx-js/example-vanilla dev
```

To build the bundle:

```bash
pnpm turbo build
```

The build targets the `web` and `lynx` environments and emits these bundles:

| Entry      | Source               | Native bundle             | Web bundle               |
| ---------- | -------------------- | ------------------------- | ------------------------ |
| TypeScript | `src/main/index.ts`  | `dist/main.lynx.bundle`   | `dist/main.web.bundle`   |
| LynXML     | `src/counter.lynxml` | `dist/lynxml.lynx.bundle` | `dist/lynxml.web.bundle` |

The config uses `pluginLynx()` from `@lynx-js/rsbuild-plugin`. The TypeScript
`source.entry.main` calls the matching thread's setup function using
`__MAIN_THREAD__` and `__BACKGROUND__`. The setup modules register listeners
when called.

The `source.entry.lynxml` entry puts all CSS and both thread scripts in
`counter.lynxml`, with no imports or external resources. Its main-thread script
builds the counter, handles taps, and applies background patches using Element
PAPI. It uses `lynx.getEngine()` for lifecycle events and `lynx.getJSContext()`
to communicate with the background script's `lynx.getCoreContext()`. The
background script owns the count; both threads remove listeners on destruction.

The XML parser validates `engine-version`; compiled entries currently use
Vanilla's default encoder and runtime-wrapper version (`3.2`).

The development server rebuilds on source changes. Reload the page in its host after a rebuild; direct thread entries do not install an HMR or live-reload runtime.

The example explicitly enables `enableEventHandleRefactor` through `pluginLynxConfig` for its Element PAPI listeners. The entry builder does not set page configuration flags.
