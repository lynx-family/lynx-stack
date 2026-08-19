---
"@lynx-js/web-core": patch
---

Build `binary/encode` with `wasm-bindgen --target bundler` and publish `@lynx-js/web-core/encode` as an rslib bundle, so one set of artifacts serves both Node and the browser.

**Why**

`binary/encode` used to be generated with `--target experimental-nodejs-module`, whose glue calls `readFileSync('node:fs')` at module scope. That made `@lynx-js/web-core/encode` importable from Node only. The `bundler` target instead emits an "async wasm module" glue (`import * as wasm from './encode_bg.wasm'`), which a bundler can resolve for either platform.

**What changed in the published package**

- `./encode` now resolves to `dist/encode_prod/index.js` (bundled by rslib, like `./server` already was) instead of the unbundled `dist/encode/index.js` emitted by `tsc`. The wasm is emitted as a build asset under `dist/encode_prod/static/wasm/`.
- Bundling is what keeps the import clean: consuming the `bundler` glue directly from Node would work only on Node 22 or newer, and would print `ExperimentalWarning: Importing WebAssembly module instances` on every build. Letting rslib resolve the wasm at web-core build time avoids both.
- `encode_bg.wasm` is byte-for-byte unchanged; only the JavaScript glue differs. The `binary/encode/*.d.ts` type declarations are identical under both targets.

**Compatibility**

- No API change. `encode()` and `encodeCSS(cssMap): Uint8Array` keep their synchronous signatures. The wasm initialization becomes a single module-level `await` inside the bundle, which is already accommodated by the `await import('@lynx-js/web-core/encode')` that consumers use. Encoded output is byte-identical to the previous release.
- `@lynx-js/css-serializer` stays an external dependency of the bundle and is not inlined.
- Note on Node versions: `@lynx-js/web-core/encode` does not work on Node 20 and did not work there before this change either. The `encode` wasm is optimized with `wasm-opt --all-features`, and Node 20's engine rejects it with `CompileError: Unknown heap type -14` regardless of which glue is used. This is a pre-existing limitation that this change neither introduces nor fixes; the effective floor for this entry point is Node 22.
- The tarball grows by roughly the size of the encode wasm, because `binary/encode/encode_bg.wasm` is still shipped alongside the copy that rslib emits into `dist/encode_prod/`.
