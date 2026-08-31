---
"@lynx-js/rsbuild-plugin": patch
---

Add `pluginLynx({ output: { minify } })` for the per-thread minifier options. They are merged on top of the ones Rspeedy tunnels through the Rsbuild config, and the Lynx options take precedence.
