---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-core": patch
---

fix: crash on chrome<96

https://github.com/wasm-bindgen/wasm-bindgen/issues/4211#issuecomment-2505965903

https://github.com/WebAssembly/binaryen/issues/7358

The rust toolchain enables WASM feature `reference types` by default.

However this feature is not supported by chromium lower than version 96

Therefore we found a workaround for it.

In this implementation we detect if browser supports `reference types` first.

If user's browser supported it, we load the wasm file with `reference types` on, otherwise we load the wasm file with `reference types` off.
