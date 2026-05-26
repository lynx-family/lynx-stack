---
"@lynx-js/web-core": patch
---

fix: avoid wasm 4kb error on chrome < 115

fix `Uncaught (in promise) RangeError: WebAssembly.Instance is disallowed on the main thread, if the buffer size is larger than 4KB. Use WebAssembly.instantiate.` error on `chrome < 115`
