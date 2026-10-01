---
"@lynx-js/web-core": patch
---

Free the wasm context after each `executeTemplate` call. It builds its element tree inside the wasm linear memory, which the JS GC cannot reclaim, so every server render leaked memory proportional to the page size (~340KB for a 1000-element page) for the lifetime of the process.
