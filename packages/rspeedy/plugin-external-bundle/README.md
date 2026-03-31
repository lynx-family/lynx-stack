<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@lynx-js/external-bundle-rsbuild-plugin">
    <img alt="" src="https://img.shields.io/npm/v/@lynx-js/external-bundle-rsbuild-plugin?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/@lynx-js/external-bundle-rsbuild-plugin">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

## Getting Started

```bash
npm install -D @lynx-js/external-bundle-rsbuild-plugin
```

If you want to use the built-in `reactlynx` preset, also install:

```bash
npm install -D @lynx-js/react-umd
```

## Usage

```ts
// lynx.config.ts
import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default {
  plugins: [
    pluginReactLynx(),
    pluginExternalBundle({
      externalsPresets: {
        reactlynx: true,
      },
      externals: {
        'lodash-es': {
          bundlePath: 'lodash-es.lynx.bundle',
          background: { sectionPath: 'lodash-es' },
          mainThread: { sectionPath: 'lodash-es__main-thread' },
          async: false,
        },
        './components': {
          bundlePath: 'comp.lynx.bundle',
          background: { sectionPath: 'component' },
          mainThread: { sectionPath: 'component__main-thread' },
        },
      },
    }),
  ],
}
```

If your external bundle request key already matches the produced section names,
you can use the shorthand string form:

```ts
pluginExternalBundle({
  externalsPresets: {
    reactlynx: true,
  },
  externals: {
    './App.js': 'comp.lynx.bundle',
  },
})
```

The shorthand expands to the same `bundlePath` plus default:

- `libraryName = './App.js'`
- `background.sectionPath = './App.js'`
- `mainThread.sectionPath = './App.js__main-thread'`
- `async = true`

If you need custom section names or a custom exported library name, use the
full object form instead:

```ts
pluginExternalBundle({
  externalsPresets: {
    reactlynx: true,
  },
  externals: {
    './App.js': {
      libraryName: 'CompLib',
      bundlePath: 'comp.lynx.bundle',
      background: { sectionPath: 'CompLib' },
      mainThread: { sectionPath: 'CompLib__main-thread' },
      async: true,
    },
  },
})
```

## `bundlePath` vs `url`

Prefer `bundlePath` for bundles that belong to the current project.

- `bundlePath`
  - resolves through the runtime public path
  - lets the plugin serve local bundles in development
  - lets the plugin emit managed bundle assets during build
- `url`
  - uses a fully resolved address directly
  - is better only when the bundle is hosted outside the current build output, such as on a CDN

For the built-in `reactlynx` preset, `bundlePath` is especially recommended because the plugin will automatically emit `react.lynx.bundle` by resolving `@lynx-js/react-umd/dev` or `@lynx-js/react-umd/prod`.

## Building project-owned external bundles

By default, `pluginExternalBundle` reads project-owned external bundles from `dist-external-bundle` before emitting them into the final app output.

If you use that default directory, no extra config is needed:

```ts
pluginExternalBundle({
  externals: {
    './components': {
      bundlePath: 'comp.lynx.bundle',
      background: { sectionPath: 'component' },
      mainThread: { sectionPath: 'component__main-thread' },
    },
  },
})
```

Then:

- development serves `dist-external-bundle/comp.lynx.bundle`
- production emits that bundle into the app output

If your local external bundles live somewhere else, set `externalBundleRoot` explicitly.

## ReactLynx preset

`externalsPresets.reactlynx` expands the standard ReactLynx module requests automatically, so you do not need to write the full externals map by hand.

If your app needs business-specific presets, define them next to
`externalsPresets`:

```ts
pluginExternalBundle({
  externalsPresets: {
    lynxUi: true,
  },
  externalsPresetDefinitions: {
    lynxUi: {
      resolveExternals() {
        return {
          '@lynx-js/lynx-ui': {
            libraryName: ['LynxUI', 'UI'],
            bundlePath: 'lynx-ui.lynx.bundle',
            background: { sectionPath: 'LynxUI' },
            mainThread: { sectionPath: 'LynxUI__main-thread' },
            async: false,
          },
        }
      },
    },
  },
})
```

If you want to extend the built-in `reactlynx` preset instead of defining a
completely separate one, use `extends`:

```ts
pluginExternalBundle({
  externalsPresets: {
    reactlynxPlus: true,
  },
  externalsPresetDefinitions: {
    reactlynxPlus: {
      extends: 'reactlynx',
      resolveExternals() {
        return {
          '@lynx-js/lynx-ui': {
            libraryName: ['LynxUI', 'UI'],
            bundlePath: 'lynx-ui.lynx.bundle',
            background: { sectionPath: 'LynxUI' },
            mainThread: { sectionPath: 'LynxUI__main-thread' },
            async: false,
          },
        }
      },
    },
  },
})
```

Use it together with `@lynx-js/lynx-bundle-rslib-config` when producing external bundles:

```ts
import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'

export default defineExternalBundleRslibConfig({
  output: {
    externalsPresets: {
      reactlynx: true,
    },
  },
})
```

## Documentation

Visit [Lynx Website](https://lynxjs.org/api/rspeedy/external-bundle-rsbuild-plugin) to view the full documentation.

## Contributing

Contributions to Rspeedy are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](/CONTRIBUTING.md) to make sure you have a smooth experience contributing to this project.

## License

Rspeedy is Apache-2.0 licensed.
