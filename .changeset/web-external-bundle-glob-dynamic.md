---
"@lynx-js/web-core": patch
---

Fix `globDynamicComponentEntry is not defined` when a web external bundle's main-thread (lepus) chunk is evaluated.

An external bundle's mts chunk references `globDynamicComponentEntry` bare — a card's own root receives it as a wrapping function parameter, but an external chunk does not. The decode worker now declares it in the CommonJS env it already builds for external bundle chunks, so evaluating them no longer throws a `ReferenceError`.
