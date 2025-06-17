---
"@lynx-js/template-webpack-plugin": patch
---

Avoid generating lazy bundles when there are no chunk name.

E.g.: using `import.meta.webpackContext`.
