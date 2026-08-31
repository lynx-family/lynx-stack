---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Skip the built-in `pluginLynx` when one is already applied, so a user who needs to configure the Lynx build engine can apply `pluginLynx` themselves and have their options win. `@lynx-js/rspeedy` becomes an optional peer dependency of `pluginReactLynx` and `pluginQRCode`.
