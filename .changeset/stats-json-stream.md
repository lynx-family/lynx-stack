---
"@lynx-js/rspeedy": patch
---

Write `stats.json` in chunks, so that a large project no longer fails with `RangeError: Invalid string length` when `performance.profile` is enabled.
