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
      component: './src/components/index.js',
    },
  },
  plugins: [pluginReactLynx()],
  output: {
    distPath: {
      root: 'dist-external-bundle',
    },
    externalsPresets: {
      reactlynx: true,
    },
  },
});
```

That preset maps the standard ReactLynx module requests to the globals exposed by the React UMD bundle.

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
      externalBundleRoot: 'dist-external-bundle',
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        './components': {
          bundlePath: 'comp.lynx.bundle',
          background: { sectionPath: 'component' },
          mainThread: { sectionPath: 'component__main-thread' },
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

## Manual Hosting

If you host the React runtime bundle on a CDN or another server, you can still override the preset with `url`, but `bundlePath` is recommended because it keeps the runtime aligned with the current build output and enables automatic asset emission.

For a full working example, see [examples/react-externals](../../examples/react-externals/README.md).
