---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Route lepus runtime chunks (including `worklet-runtime`) through the standard chunk compilation pipeline so sourcemaps can be discovered by upload plugins, while keeping template injection name and runtime loading behavior unchanged.

`@lynx-js/react-webpack-plugin` now compiles lepus chunks as normal entries, injects compiled output into template lepus chunks, and removes generated lepus chunk assets from final output after report-stage processing.

`@lynx-js/react-rsbuild-plugin` updates runtime-wrapper exclusion to use lepus chunk names (instead of hardcoded single-chunk matching), ensuring main-thread/lepus executable chunks keep plain output.
