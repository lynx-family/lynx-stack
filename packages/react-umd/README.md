# @lynx-js/react-umd

`@lynx-js/react-umd` ships prebuilt ReactLynx runtime bundles for external-bundle workflows.

It exposes two entry points:

- `@lynx-js/react-umd/dev`
- `@lynx-js/react-umd/prod`

`@lynx-js/external-bundle-rsbuild-plugin` resolves one of these entry points automatically for the built-in `reactlynx` preset, based on `NODE_ENV`.

## Build

```bash
pnpm build
```

This generates:

- `dist/react-dev.lynx.bundle`
- `dist/react-prod.lynx.bundle`

## Recommended Usage

For most projects, use this package through the `reactlynx` preset instead of wiring ReactLynx externals by hand.

### Producing a component external bundle

If you are building a Lynx external bundle that depends on ReactLynx, use `externalsPresets.reactlynx` in `defineExternalBundleRslibConfig`:

```ts
import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineExternalBundleRslibConfig({
  id: 'comp',
  source: {
    entry: {
      './components': './src/components/index.js',
    },
  },
  plugins: [pluginReactLynx()],
  output: {
    externalsPresets: {
      reactlynx: true,
    },
  },
});
```

That preset maps the standard ReactLynx module requests to the globals exposed by the React UMD bundle. Using the same `./components` request key on both sides keeps the produced external section names aligned with the host app shorthand configuration.

If you need extra business-specific presets, you can define them alongside
`externalsPresets`:

```ts
export default defineExternalBundleRslibConfig({
  output: {
    externalsPresets: {
      reactlynx: true,
      lynxUi: true,
    },
    externalsPresetDefinitions: {
      lynxUi: {
        externals: {
          '@lynx-js/lynx-ui': ['LynxUI', 'UI'],
        },
      },
    },
  },
});
```

You can also extend the built-in preset directly:

```ts
export default defineExternalBundleRslibConfig({
  output: {
    externalsPresets: {
      reactlynxPlus: true,
    },
    externalsPresetDefinitions: {
      reactlynxPlus: {
        extends: 'reactlynx',
        externals: {
          '@lynx-js/lynx-ui': ['LynxUI', 'UI'],
        },
      },
    },
  },
});
```

### Consuming external bundles in a Lynx app

In the host app, use `pluginExternalBundle` with the same `reactlynx` preset:

```ts
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        './components': 'comp.lynx.bundle',
      },
    }),
  ],
});
```

If you need custom section names instead of deriving them from the request key,
use the full object form:

```ts
export default defineConfig({
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        './components': {
          libraryName: 'CompLib',
          bundlePath: 'comp.lynx.bundle',
          background: { sectionPath: 'CompLib' },
          mainThread: { sectionPath: 'CompLib__main-thread' },
          async: true,
        },
      },
    }),
  ],
});
```

When the preset uses `bundlePath` instead of an explicit `url`, the plugin will:

- resolve `@lynx-js/react-umd/dev` or `@lynx-js/react-umd/prod`
- emit `react.lynx.bundle` into the app output
- load it through the runtime public path

The same extension pattern is available on the consumer side through
`pluginExternalBundle({ externalsPresetDefinitions })`.

## Manual Hosting

If you host the React runtime bundle on a CDN or another server, you can still override the preset with `url`, but `bundlePath` is recommended because it keeps the runtime aligned with the current build output and enables automatic asset emission.

For a full working example, see [examples/react-externals](../../examples/react-externals/README.md).
