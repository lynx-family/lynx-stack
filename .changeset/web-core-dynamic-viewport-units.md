---
"@lynx-js/web-core": patch
---

Keep `dvh`, `svw` and other dynamic or small/large viewport units unchanged when `vw`/`vh` transformation is enabled, instead of emitting broken values such as `calc(100d * var(--vh-unit))`.
