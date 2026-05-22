# `@lynx-js/debug-metadata-rsbuild-plugin`

Emits `debug-metadata.json` alongside each Lynx template build, serves it via dev-server endpoints, and repoints JS / tasm debug URLs at the unified file. Consumed by reverse-symbolication services and element inspectors.

**Auto-registered by `@lynx-js/rspeedy` as a default plugin** — Rspeedy users should not apply it explicitly.

## What lands on disk

Per Lynx entry (`<intermediate>` defaults to `.rspeedy/<entry>`):

```text
dist/<intermediate>/debug-metadata.json    one unified file per entry
```

The shape is `DebugMetadataAsset` from [`@lynx-js/debug-metadata`](../../tools/debug-metadata/README.md) — artifacts (JS / CSS / bytecode with their debug sources), UI source map, git + rspeedy meta.

## Dev-server endpoints

The plugin installs a connect-style middleware that serves `?field=…` queries off `debug-metadata.json`:

```http
GET <publicPath>/<intermediate>/debug-metadata.json
GET <publicPath>/<intermediate>/debug-metadata.json?field=source-map&filename=<basename>.js.map
GET <publicPath>/<intermediate>/debug-metadata.json?field=source-map&key=<chunk hash>
GET <publicPath>/<intermediate>/debug-metadata.json?field=bytecode-debug-info&filename=main-thread.js
GET <publicPath>/<intermediate>/debug-metadata.json?field=artifact&filename=…
GET <publicPath>/<intermediate>/debug-metadata.json?field=artifacts
GET <publicPath>/<intermediate>/debug-metadata.json?field=ui-source-map
GET <publicPath>/<intermediate>/debug-metadata.json?field=meta   (or git / rspeedy)
```

The middleware dispatches through the `FIELDS` registry in `@lynx-js/debug-metadata` — adding a new queryable field is a one-line `FIELDS.set(...)` in that package; no edits here. Resolvers' `payload` hook is honored automatically (e.g. `?field=source-map` returns the raw v3 map, not the `SourceMapDebugSource` wrapper).

Status codes:

| status | error code                                     | meaning                                                 |
| ------ | ---------------------------------------------- | ------------------------------------------------------- |
| 200    | —                                              | matched; JSON body is the unwrapped payload             |
| 400    | `invalid_field`                                | unknown `field=` (allowed list returned)                |
| 404    | `metadata_not_found`                           | no `debug-metadata.json` adjacent to the requested path |
| 404    | `not_found`                                    | field is registered but no value matched the query      |
| 500    | `metadata_parse_error` / `metadata_read_error` | corrupt JSON / fs error                                 |

## Build-time URL rewrites

To get every consumer pointed at the unified endpoint, the plugin rewrites three things during build:

- **JS / CSS `sourceMappingURL` trailers.** Whatever the original trailer pointed at is discarded; the new URL is `<publicPath>/<intermediate>/debug-metadata.json?field=source-map&path=<encoded bundler-relative map path>`. JS keeps the `//#` line-comment form, CSS keeps the `/*# … */` block-comment form. The rewrite runs inside `templateHooks.beforeEncode` so the encoded template binary embeds the new trailer, and the rewritten source is mirrored back into `encodeData.lepusCode` / `encodeData.manifest` (CSS goes through `@lynx-js/css-serializer`, so only `compilation.updateAsset` is needed for it). Only Lynx envs are touched — multi-env builds (web + lynx) leave the non-lynx env alone.
- **tasm `compilerOptions.templateDebugUrl`.** Points at `<publicPath>/<intermediate>/debug-metadata.json?field=bytecode-debug-info&filename=main-thread.js` instead of the legacy `debug-info.json`. Left empty when `publicPath` is `auto` / `/` (unchanged from previous behavior).
- **tasm `sourceContent.config.debugMetadataUrl`.** The base endpoint without any query — `<publicPath>/<intermediate>/debug-metadata.json`. Consumers append their own `?field=…` to it. Left empty when `publicPath` is `auto` / `/`.

The legacy `debug-info.json` is **no longer written to disk** — its contents are accessible via the bytecode-debug-info endpoint above.

## Contents

- `pluginLynxDebugMetadata` — the Rsbuild plugin wrapper (the only public export), applied by `applyDefaultPlugins` in `@lynx-js/rspeedy/core`. Internally it taps `LynxTemplatePlugin.beforeEncode` to assemble + emit the metadata asset and to rewrite JS / CSS source-map trailers, and `beforeEmit` to enrich the asset with `tasmSection` paths and bytecode debug info.

## Convention for plugin authors

Any rsbuild plugin that drives `LynxTemplatePlugin` (DSL plugins like `pluginReactLynx`, or custom local plugins) **must** publish the plugin class via the standard exposure:

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

`pluginLynxDebugMetadata` reads this exposure to discover where to tap the template hook chain. Setup throws fast with an actionable error if no exposure is found, so missing the convention is a build-time error rather than a silent miss of `debug-metadata.json`.
