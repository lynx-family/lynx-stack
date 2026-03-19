# @lynx-js/react-umd

This package provides a standalone, Universal Module Definition (UMD) build of the `ReactLynx` runtime. It is designed to be used as an **external bundle**, allowing multiple Lynx components or applications to load a single React runtime instance over the network, which improves load time, caches efficiency, and reduces memory usage.

## Purpose

When building Lynx applications, the ReactLynx runtime is typically bundled directly into the application instance. However, for advanced use cases like micro-frontends or dynamically loading remote components, it's highly beneficial to expose ReactLynx as an external dependency. `react-umd` pre-bundles ReactLynx so that it can be loaded on-demand and shared across different parts of your Lynx app.

## Building

To build the development and production bundles locally:

```bash
pnpm build
```

The script will automatically execute:

- `pnpm build:development` (sets `NODE_ENV=development`)
- `pnpm build:production` (sets `NODE_ENV=production`)

This generates the following artifacts in the `dist/` directory:

- `react-dev.lynx.bundle`
- `react-prod.lynx.bundle`

## Usage as an External Bundle

For a full working example of how to serve and consume this external bundle, see the [`react-externals` example](../../examples/react-externals/README.md) in this repository.

Typically, you will use `@lynx-js/external-bundle-rsbuild-plugin` to map `@lynx-js/react` and its internal modules directly to the URL where this UMD bundle is served in your Lynx config file (eg. `lynx.config.ts`).

### 1. Consuming in a Custom Component Bundle (`rslib.config.ts`)

If you are building your own external UI component library that relies on React, you should map the React imports to the global variable exposed by this UMD bundle.

```ts
// rslib-comp-lib.config.ts
export default defineExternalBundleRslibConfig({
  output: {
    externals: {
      '@lynx-js/react': ['ReactLynx', 'React'],
      '@lynx-js/react/internal': ['ReactLynx', 'ReactInternal'],
      '@lynx-js/react/jsx-dev-runtime': ['ReactLynx', 'ReactJSXDevRuntime'],
      '@lynx-js/react/jsx-runtime': ['ReactLynx', 'ReactJSXRuntime'],
      '@lynx-js/react/lepus/jsx-dev-runtime': [
        'ReactLynx',
        'ReactJSXLepusDevRuntime',
      ],
      '@lynx-js/react/lepus/jsx-runtime': ['ReactLynx', 'ReactJSXLepusRuntime'],
      '@lynx-js/react/experimental/lazy/import': [
        'ReactLynx',
        'ReactLazyImport',
      ],
      '@lynx-js/react/legacy-react-runtime': [
        'ReactLynx',
        'ReactLegacyRuntime',
      ],
      '@lynx-js/react/runtime-components': ['ReactLynx', 'ReactComponents'],
      '@lynx-js/react/worklet-runtime/bindings': [
        'ReactLynx',
        'ReactWorkletRuntime',
      ],
      '@lynx-js/react/debug': ['ReactLynx', 'ReactDebug'],
      'preact': ['ReactLynx', 'Preact'],
    },
  },
});
```

### 2. Resolving the Bundle in a Lynx App (`lynx.config.ts`)

In the host application, configure the Rsbuild plugin to load the React UMD bundle into the correct engine layers (Background Thread and Main Thread) when the app starts.

```ts
// lynx.config.ts
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginExternalBundle({
      externals: {
        '@lynx-js/react': {
          libraryName: ['ReactLynx', 'React'],
          url: `http://<your-server>/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        // ... include similar configurations for other @lynx-js/react/* subpaths
      },
    }),
  ],
});
```

> Note: Ensure you map both the `background` and `mainThread` configurations properly so that React successfully attaches across the threaded architecture.
