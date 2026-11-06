---
'@lynx-js/react-rsbuild-plugin': patch
---

Respect `output.minify: false` when `enableRemoveCSSScope` is `false`. Previously `lynx:react:css-minify-guard` merged `{ css: false }` into `output.minify`, which turned `false` into an object and re-enabled JS minification.
