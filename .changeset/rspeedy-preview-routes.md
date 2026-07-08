---
"@lynx-js/rspeedy": patch
---

Expose Lynx bundle routes to preview server hooks.

`onAfterStartPreviewServer` now receives the same Lynx bundle route entries as `onAfterStartDevServer`, so plugins can discover preview bundle entries from the `routes` parameter.
