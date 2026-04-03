---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Add `removeCall` for shake function calls. Its initial default value matches the hooks that were previously in `removeCallParams`, and `removeCallParams` now defaults to empty.

`removeCall` removes matched runtime hook calls entirely, replacing them with `undefined` in expression positions and dropping them in statement positions. `removeCallParams` keeps the existing behavior of preserving the call while stripping its arguments.
