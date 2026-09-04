---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/vanilla-rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
"@lynx-js/config-rsbuild-plugin": patch
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/external-bundle-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Declare the build host as an optional peer dependency. `@rsbuild/core` covers a plain Rsbuild build, and `@lynx-js/rspeedy` covers an Rspeedy one, so whichever host is installed is version-checked.
