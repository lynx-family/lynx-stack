---
"@lynx-js/template-webpack-plugin": patch
---

Always inline a lazy bundle's background (bts) chunk.

A lazy bundle (`appType: "DynamicComponent"`) runs its background synchronously when the bundle is required, so its bts must be inlined into `app-service.js`. Previously a non-matching `inlineScripts` matcher could externalize it via `lynx.requireModuleAsync`, leaving the module unavailable at `installChunk` time and breaking the bundle. The bts of a lazy bundle is now always inlined regardless of `inlineScripts`; the option still applies to card templates.
