---
"@lynx-js/web-core": patch
---

Preserve each fetched bundle's virtual source URL while executing decoded background and main-thread scripts so `output.publicPath: 'auto'` resolves lazy assets relative to the bundle instead of Web Core's worker or blob URL. Add `lynx.loadLazyBundle` to execute decoded lazy bundles in either realm, and treat empty lazy main-thread chunks as no-ops instead of invalid `module.exports=` scripts.
