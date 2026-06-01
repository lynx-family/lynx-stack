---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/chunk-loading-webpack-plugin": patch
"@lynx-js/cache-events-webpack-plugin": patch
"@lynx-js/css-extract-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Prefix Lynx runtime module names with `webpack/runtime/` (e.g. `Lynx async chunks` → `webpack/runtime/lynx async chunks`), matching the path-structured naming of the bundler's built-in runtime modules. The previous bare names had no path segment, so when they appear as a source-map `sources` entry under a `file://` module-filename template they collapsed into an invalid URL authority (the space-containing name became the host) and broke `SourceMapConsumer` parsing.
