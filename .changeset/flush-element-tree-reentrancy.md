---
"@lynx-js/web-core": patch
---

Allow `__FlushElementTree()` to run inside a main-thread event handler without
triggering wasm-bindgen's recursive-borrow error or aborting the remaining
event dispatch.
