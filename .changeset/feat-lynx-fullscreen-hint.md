---
"@lynx-js/qrcode-rsbuild-plugin": patch
---

feat(qrcode-rsbuild-plugin): print fullscreen URL hint in dev server output

Append a `∟ No nav` entry with `?fullscreen=true` under each Lynx bundle URL printed by the dev server. Tapping the variant opens the bundle in LynxExplorer with the in-app navigation chrome stripped. Disable via the new `fullscreen: false` option.
