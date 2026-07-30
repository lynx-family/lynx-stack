---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/chunk-loading-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/webpack-runtime-globals": patch
---

Drop the `(function (globDynamicComponentEntry) { ... })` wrapper from
FetchBundle main-thread chunks — FetchBundle artifacts no longer reference
`globDynamicComponentEntry` at all.

- Chunks use the same shell as the external-bundle main-thread wrapper
  (`MainThreadRuntimeWrapperWebpackPlugin`): a parameterless self-invoking
  IIFE whose completion value is the exports (`return module.exports`). The
  IIFE is required for correctness: `lynx.loadScript` evaluates chunks as
  programs in the shared main-thread realm, where the webpack bootstrap's
  top-level bindings would otherwise clobber the page's.
- Snapshot uids compile to bare literals: a uid already embeds the module's
  filename and content hashes (`__snapshot_<filename>_<content>_<n>`), so it
  needs no per-load entry prefix to stay unique across bundles, and the
  FetchBundle runtime never consumes a snapshot's entryName. Snapshot entry
  names and element-template uid scopes compile to the `__Card__` literal.
- `processEvalResultByHost` is keyed by the compile-time host id
  (`uniqueName#entryName`, `deriveLynxHostId`), emitted as
  `__webpack_require__.lynx_hid` and passed by chunk loading as a nested
  lazy-bundle import's `host` — no shared mutable global anywhere in the
  load path.
- The main-thread loader reduces to `lynx.loadScript` + the completion
  value; the entry window and wrapper-shape dispatch are gone. **FetchBundle
  lazy bundles built with earlier releases (the wrapper protocol shipped in
  `@lynx-js/react` 0.123) must be rebuilt with a matching toolchain.** The
  QueryComponent protocol and its artifacts are unaffected.
