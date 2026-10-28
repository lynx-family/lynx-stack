---
applyTo: "packages/motion/**"
---

Lynx for Web wraps each MTS chunk with a mutable lexical `window` binding so dependencies do not accidentally access the iframe's browser window while compatibility shims can replace it. Gate direct lexical assignment to `SystemInfo.platform === "web"` and preserve the `globalThis.window` fallback for native Lynx. Keep the lexical assignment wrapped in try/catch: older Lynx for Web runtimes declare the chunk-local binding as a `const`, and the shim must degrade to skipping the window facade instead of crashing the MTS chunk.

The Lynx for Web MTS realm also exposes browser DOM constructors. Motion must replace the constructors it already shims, such as `Element` and `HTMLElement`, because Lynx main-thread elements are not browser DOM nodes.

Keep public Motion subpaths aligned in `exports` and `typesVersions`: legacy TypeScript `moduleResolution: "node"` does not read `exports`. Follow React and testing-environment's explicit subpath mappings so the root `types` entry remains unchanged. Verify both entry points against the built declarations with `node`, `node16`, `nodenext`, and `bundler`, covering import and require lookup conditions as well as consumer type checking. Motion publishes ESM; CommonJS consumer checks should load it with dynamic `import()` rather than implying a separate CommonJS build exists.
