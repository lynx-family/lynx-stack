---
"@lynx-js/externals-loading-webpack-plugin": minor
---

Fetch asynchronous external bundles on first import instead of prefetching unused bundles during startup. Preserve startup prefetching for bundles shared with synchronous or runtime-selected externals.

Propagate fetch failures to the importing module instead of leaving its loading Promise pending.
