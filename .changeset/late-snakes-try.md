---
"@lynx-js/web-core": patch
---

fix: avoid wasm 4kb error on chrome < 115

fix `Uncaught (in promise) RangeError: WebAssembly.Instanceis disallowed on the main thread, if the buffer size islargerthan 4KB. Use WebAssembly.instantiate.` error on `chrome < 115`
