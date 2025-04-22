---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/web-core": patch
---

fix(web): css selector not work for selectors with combinator and pseudo-class on WEB

like `.parent > :not([hidden]) ~ :not([hidden])`

you will need to upgrade your `react-rsbuild-plugin` to fix this issue
