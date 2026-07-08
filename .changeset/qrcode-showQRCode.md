---
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Add `showQRCode` option to `registerConsoleShortcuts`.

When passed `showQRCode: false`, the shortcut runtime still prints URL(s) and keeps the interactive schema/entry switching, but skips rendering the ASCII QR code. This lets embedders that always launch via a deep link (or wrap the plugin with their own connection flow — e.g. `@byted-lynx/hdt-rsbuild-plugin`) suppress the QR block without forking the shortcut loop. Default remains `true`, so existing behavior is unchanged.
