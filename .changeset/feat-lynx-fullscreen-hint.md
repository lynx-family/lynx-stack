---
"@lynx-js/qrcode-rsbuild-plugin": patch
---

feat(qrcode-rsbuild-plugin): add optional `fullscreen` URL hint + QR schema variant

When enabled (default `fullscreen: true`), the plugin:

- Appends an `∟ Fullscreen` URL line under each Lynx bundle URL printed by the dev server (with `?fullscreen=true`).
- Appends a `fullscreen` entry to the QR schema rotation — the QR still opens on the user's default schema for back-compat; press `a` in the dev console to switch to `fullscreen`.

Both open the bundle in LynxExplorer with the in-app navigation chrome stripped. Disable via `fullscreen: false`.
