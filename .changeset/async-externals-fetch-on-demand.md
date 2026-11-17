---
"@lynx-js/externals-loading-webpack-plugin": minor
---

Fetch external bundles on first import instead of prefetching unused bundles during startup. Preserve synchronous exports and asynchronous Promise semantics, including runtime-selected loading modes.

Propagate fetch failures to the importing module instead of leaving its loading Promise pending.
