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
