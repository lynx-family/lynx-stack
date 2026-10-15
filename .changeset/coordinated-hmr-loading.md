---
'@lynx-js/chunk-loading-webpack-plugin': patch
'@lynx-js/webpack-dev-transport': patch
---

Add internal HMR loading and update coordination hooks. Allow coordinated updates to refresh cached module factories, serialize application, detect timeouts, preserve runtime hashes on reconnect, and reload once on failure using a valid Native CDP request.
