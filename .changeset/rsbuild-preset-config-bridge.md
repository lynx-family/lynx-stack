---
"@lynx-js/preset-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

`pluginLynxPreset()` now accepts a Lynx `Config`, and a new `loadLynxConfig()` loads an existing `lynx.config.ts`, so a project can migrate off the Rspeedy CLI to the Rsbuild CLI without rewriting its config: `pluginLynxPreset(await loadLynxConfig())`. The config schema and its loader (`loadConfig`, `defineConfig`, and the TypeScript `register` hook) now live in `@lynx-js/preset-rsbuild-plugin`; `@lynx-js/rspeedy` re-exports them unchanged.
