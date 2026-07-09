---
"@lynx-js/webpack-runtime-globals": patch
---

feat(lazy-bundle): add the lazy-bundle runtime globals

Add the runtime globals the FetchBundle loader relies on: the async-chunk id/mode
maps (`lynx_aci` / `lynx_acm`) and the `processEvalResult` host hook.
