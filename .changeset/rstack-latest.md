---
"@lynx-js/rspeedy": patch
"@lynx-js/react": patch
---

Update the Rstack toolchain: Rspack 2.2.2, Rsbuild 2.2.3, Rslib 1.0.0 and Rstest 0.11.12.

`@lynx-js/rspeedy` carries `@rsbuild/core` from the catalog in `dependencies`, so its published range moves. `@lynx-js/react` ships `transform/dist/wasm.cjs`, which is rebuilt from the SWC plugin crates against `swc_core` 77.
