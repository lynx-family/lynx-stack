---
"@lynx-js/qrcode-rsbuild-plugin": patch
---

feat(qrcode-rsbuild-plugin): default QR to fullscreen + add `∟ Fullscreen` URL hint

When enabled (default `fullscreen: true`), the plugin now:

- Prepends a `fullscreen` entry to the QR schema rotation, so the dev server's QR code opens the bundle in LynxExplorer with the in-app navigation chrome stripped by default. Press `a` in the dev console to switch to the user-defined (nav) variant(s).
- Appends an `∟ Fullscreen` URL line under each Lynx bundle URL printed by the dev server.

Disable via `fullscreen: false`.
