# `@lynx-js/debug-metadata-rsbuild-plugin`

Emits `debug-metadata.json` alongside each Lynx template build. The
metadata is consumed by reverse symbolication services and element
inspectors.

This package is **auto-registered by `@lynx-js/rspeedy` as a default
plugin** — Rspeedy users should not apply it explicitly.

## Contents

- `LynxDebugMetadataPlugin` — the underlying webpack/rspack plugin that
  taps into `LynxTemplatePlugin`'s `beforeEncode` hook and writes the
  metadata asset to the per-entry intermediate directory.
- `pluginLynxDebugMetadata` — the Rsbuild plugin wrapper, applied by
  `applyDefaultPlugins` in `@lynx-js/rspeedy/core`.

## Convention for plugin authors

Any rsbuild plugin that drives `LynxTemplatePlugin` (DSL plugins like
`pluginReactLynx`, or custom local plugins) **must** publish the plugin
class via the standard exposure:

```ts
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

export function myPlugin() {
  return {
    name: 'my:plugin',
    setup(api) {
      api.expose(Symbol.for('LynxTemplatePlugin'), { LynxTemplatePlugin })
      api.modifyBundlerChain(chain => {
        chain.plugin('template').use(LynxTemplatePlugin, [/* … */])
      })
    },
  }
}
```

`pluginLynxDebugMetadata` reads this exposure to discover where to tap
the template hook chain. Setup throws fast with an actionable error if
no exposure is found, so missing the convention is a build-time error
rather than a silent miss of `debug-metadata.json`.
