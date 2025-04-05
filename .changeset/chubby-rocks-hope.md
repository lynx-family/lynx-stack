---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/web-webpack-plugin": patch
---

Delay remove of intermediate debugging assets to afterEmit, this will fix the sourcemap not being generated issue.
