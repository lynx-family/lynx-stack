---
"@lynx-js/web-elements": patch
---

Avoid mutating light DOM in `RawTextAttributes` while disconnected so `cloneNode(false)` on `<raw-text>` and `<x-text>` does not append duplicate text nodes.
