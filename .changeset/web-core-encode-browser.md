---
"@lynx-js/web-core": patch
---

Resolve `@lynx-js/web-core/encode` to the unbundled encoder under the `browser` condition. A browser bundle now loads its wasm through the bundler instead of `node:fs`, so `WebEncodePlugin` can encode web bundles in the browser through `@rspack/browser`. Node.js keeps using the prebuilt `dist/encode_prod`.
