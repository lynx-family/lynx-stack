---
'@lynx-js/lynx-runtime': patch
'@lynx-js/react': patch
---

Add `@lynx-js/lynx-runtime` with DSL-neutral MTS (`@lynx-js/lynx-runtime/mts`) and page-scoped BTS (`@lynx-js/lynx-runtime/bts`) host primitives covering initial data, incremental/reset updates, reloads, GlobalProps, destruction lifecycle, `ContextProxy` peer messages, raw BTS event dispatch (`setEventHandler`), and performance pipeline timing.

Adopt `@lynx-js/lynx-runtime` across ReactLynx Snapshot and Element Template while keeping rendering, diff/patch, hydration queues, and internal Snapshot phase dispatch in `@lynx-js/react`.
