---
"@lynx-js/web-elements": patch
---

Fix `x-text` custom inline truncation so inline `x-view` children are measured as one inline box instead of double-counting their descendants as extra lines.
