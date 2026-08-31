---
"@lynx-js/qrcode-rsbuild-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/vanilla-rsbuild-plugin": minor
"@lynx-js/config-rsbuild-plugin": patch
"@lynx-js/external-bundle-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

**BREAKING CHANGE**: Require `@lynx-js/rspeedy` `^0.17.0` in the plugins that read the build engine config through `Symbol.for('@lynx-js/rsbuild-plugin:config')`, since the engine that ships with `0.16` does not expose it. The plugins that do not touch the engine keep their existing range and add `^0.17.0` to it.
