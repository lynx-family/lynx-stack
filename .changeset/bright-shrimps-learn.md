---
"@lynx-js/lynx-bundle-rslib-config": patch
---

Preserve the default external-bundle `output.minify.jsOptions` when users set `output.minify: true` in `defineExternalBundleRslibConfig`, so required minifier options are not lost.
