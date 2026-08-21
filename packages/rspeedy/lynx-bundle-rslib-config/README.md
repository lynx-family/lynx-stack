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

### Debug metadata

External bundle builds participate in the standard `LynxTemplatePlugin`
lifecycle, so `pluginLynxDebugMetadata` can collect source maps and per-section
TASM bytecode debug information without an adapter:

```ts
import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

export default defineExternalBundleRslibConfig({
  source: {
    entry: {
      'component-runtime': {
        import: './src/component-runtime.ts',
        layer: 'main-thread',
      },
    },
  },
  output: {
    sourceMap: {
      js: 'source-map',
    },
  },
  plugins: [
    pluginReactLynx(),
    pluginLynxDebugMetadata(),
  ],
})
```

Main-thread status comes from the configured entry layer. Metadata routing uses
the emitted asset's actual TASM custom-section name, so entry names remain
application-defined.

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
