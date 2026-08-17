---
"@lynx-js/web-core": minor
---

`lynx.reload()` now accepts the same `(value, callback)` signature as native: an optional `value` object becomes the reloaded page's new initial data, and `callback` fires once the reload has finished rendering. Previously `lynx.reload()` ignored both arguments and only reloaded with the existing data.
