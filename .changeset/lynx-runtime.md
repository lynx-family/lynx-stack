---
'@lynx-js/lynx-runtime': patch
---

Add `@lynx-js/lynx-runtime` as an early `0.0.x` preview package (public APIs are not yet guaranteed to be stable prior to formal RFC stabilization), providing DSL-neutral MTS (`@lynx-js/lynx-runtime/mts`) and page-scoped BTS (`@lynx-js/lynx-runtime/bts`) host primitives covering initial data, incremental/reset updates, reloads, `GlobalProps`, page destruction lifecycle, `ContextProxy` peer messages, `GlobalEventEmitter` subscriptions (`onGlobalEvent`), raw BTS event dispatch (`setEventHandler`), root element flushing (`flushElementTree`), `SystemInfo`, and performance pipeline timing.
