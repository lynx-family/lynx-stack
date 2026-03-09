---
"@lynx-js/react-webpack-plugin": patch
---

Route lepus runtime chunks, including `worklet-runtime`, through the standard chunk compilation pipeline so sourcemaps can be discovered by upload plugins while keeping template injection names and runtime loading behavior unchanged.

`@lynx-js/react-webpack-plugin` now compiles lepus chunks as normal entries, injects the compiled output into template lepus chunks, and removes generated lepus chunk assets from final output after report-stage processing.
