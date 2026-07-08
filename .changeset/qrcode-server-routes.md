---
"@lynx-js/qrcode-rsbuild-plugin": minor
---

Read QR code entries from Rspeedy server routes.

BREAKING CHANGE: `@lynx-js/qrcode-rsbuild-plugin` now requires `@lynx-js/rspeedy@^0.15.3` because it relies on dev and preview server `routes` containing Lynx bundle entries. The plugin no longer reads the internal `rspeedy.env.entries` exposed API.
