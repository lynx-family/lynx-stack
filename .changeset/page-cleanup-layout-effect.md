---
"@lynx-js/react": patch
---

Run the `<page />` attribute-reset cleanup as a layout effect so it stays inside the unmount commit instead of a deferred passive cleanup.
