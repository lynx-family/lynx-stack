---
"@lynx-js/webpack-runtime-globals": patch
---

Add the lazy-bundle runtime globals the FetchBundle loader relies on: the
async-chunk id/mode maps (`lynx_aci` / `lynx_acm`) and the `processEvalResult`
host hook.
