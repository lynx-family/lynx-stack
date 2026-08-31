---
"@lynx-js/vanilla-rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Resolve the bundle filename through `getLynxConfig(api).resolveBundleFilename()` instead of reading `output.filename` out of the Rspeedy config. A configured filename is now honored when the plugins are used with Rsbuild directly.
