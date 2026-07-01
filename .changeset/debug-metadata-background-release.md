---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/runtime-wrapper-webpack-plugin": patch
---

fix(debug-metadata): register the background-thread release inside the bundle wrapper, keeping the legacy source-map release authoritative during the transition
