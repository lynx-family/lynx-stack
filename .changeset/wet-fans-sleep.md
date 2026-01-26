---
"@lynx-js/externals-loading-webpack-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
"@lynx-js/external-bundle-rsbuild-plugin": patch
---

Add [`globalObject`](https://webpack.js.org/configuration/output/#outputglobalobject) config for external bundle loading, user can configure it to `globalThis` for BTS external bundle sharing.
