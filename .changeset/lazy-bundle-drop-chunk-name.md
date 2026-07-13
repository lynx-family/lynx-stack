---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Fix lazy bundle intermediate files escaping the output directory when a dynamic import resolves above the compiler context. The ReactLynx transform no longer injects a `webpackChunkName`, so async chunk outputs stay inside the output directory, and each lazy bundle's intermediate JS is emitted under `.rspeedy/async/<bundle-name>/<layer>.js` (the bundle name resolved by `LynxTemplatePlugin`, with explicit `webpackChunkName` values still preserved).
