---
"@lynx-js/rspeedy": patch
---

Use the Rspack `DevTool` type for `output.sourceMap.js`. It already covers the `'-debugids'` suffix, so Rspeedy no longer restates it.
