<h2 align="center">@lynx-js/lynx-bundle-rslib-config</h2>

The package `@lynx-js/lynx-bundle-rslib-config` provides the configurations for bundling Lynx bundle with [Rslib](https://rslib.rs/).

## Usage

Use `defineExternalBundleRslibConfig` when you want to build a Lynx external
bundle that will later be loaded by `pluginExternalBundle`.

### Minimal example

```ts
import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default defineExternalBundleRslibConfig({
  id: 'comp-lib',
  source: {
    entry: {
      './App.js': './external-bundle/CompLib.tsx',
    },
  },
  plugins: [
    pluginReactLynx(),
  ],
  output: {
    externalsPresets: {
      reactlynx: true,
    },
    globalObject: 'globalThis',
  },
})
```

This produces an external bundle whose React-related requests are mapped to the
built-in `reactlynx` preset instead of a hand-written externals table.

### Custom presets

If your business bundle needs extra preset mappings, define them next to
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
})
```

If you need to extend a built-in preset instead of defining a brand new one,
use `extends`:

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
})
```

Explicit `output.externals` still override preset-provided mappings.
