---
"@lynx-js/externals-loading-webpack-plugin": patch
"@lynx-js/external-bundle-rsbuild-plugin": patch
---

Increase the default synchronous external bundle loading timeout from 2 seconds to 5 seconds to match ReactLynx lazy bundle loading. Explicit `timeout` options continue to override the default.
