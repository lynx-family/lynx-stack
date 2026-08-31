---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rsbuild-plugin": patch
---

Apply the Lynx build engine for `rslib` as well, so a library build reads the Lynx config. The plugins that shape or serve a bundle stay off, since `rslib` assembles its own.
