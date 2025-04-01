---
"@lynx-js/css-extract-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

fix: add enableCSSInvalidation for encodeCSS of css HMR, this will fix pseudo-class (such as `:active`) not working in HMR.
