---
"@lynx-js/externals-loading-webpack-plugin": patch
---

Fix `async: true` externals with a subpath `libraryName` (e.g. `['ReactLynx', 'React']`) resolving to `undefined`. The generated `promise` external now picks all subpath segments after the mounted namespace promise resolves, instead of reading them synchronously off the pending promise.
