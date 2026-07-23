---
"@lynx-js/rsbuild-plugin": minor
"@lynx-js/rspeedy": minor
"@lynx-js/react-rsbuild-plugin": patch
---

Extract the Lynx build engine (the default build plugins and their option types) into the new `@lynx-js/rsbuild-plugin` package, so a Lynx app can be built with the Rsbuild CLI directly via `pluginLynx()` instead of the Rspeedy CLI. `pluginLynx()` takes no options: build configuration is written in `rsbuild.config.ts` (or provided by DSL plugins). The `lynx.config.ts` schema (`Config`) stays in `@lynx-js/rspeedy`, which composes the engine plugins from `@lynx-js/rsbuild-plugin` — its public API is unchanged.
