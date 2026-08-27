---
"@lynx-js/rsbuild-plugin": patch
---

Add `pluginLynx({ output: { sourceMap: { debugIds } } })` for appending debug IDs to the emitted source maps. Rspeedy's `'*-debugids'` devtool suffix keeps working.
