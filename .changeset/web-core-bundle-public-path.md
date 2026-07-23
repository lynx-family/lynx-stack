---
"@lynx-js/web-core": patch
"@lynx-js/react": patch
---

Preserve each fetched bundle's source while executing decoded background and main-thread scripts so `output.publicPath: 'auto'` resolves assets relative to the bundle instead of Web Core's worker or blob URL. External bundles retain their exact URL, while component chunks receive a virtual child URL that preserves Rspeedy's lazy-bundle directory correction. Add retryable FetchBundle-based `lynx.loadLazyBundle` support in either realm, expose that loader through `@lynx-js/react/experimental/lazy/load` for startup integrations, keep lazy and external load state independent, and treat empty lazy main-thread chunks as no-ops instead of invalid `module.exports=` scripts. Mark React lazy-bundle requests explicitly so Web Core preserves their callable main-thread wrappers instead of decoding them as external containers.
