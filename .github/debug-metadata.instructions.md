---
applyTo: "packages/webpack/{react-webpack-plugin,template-webpack-plugin}/**/*"
---

Treat `debug-metadata.json` as the final unified debug asset, not as an early intermediate dump. Generate it only after every JS sourcemap that will be shipped or uploaded has already been finalized, including main-thread debug-info remapping and any late `processAssets` code transforms. When one template contains multiple runtimes, store JS sourcemaps as a `jsSourceMaps` collection rather than a single top-level map, and keep `sourceMapRelease` attached to each JS asset entry instead of the document root because Slardar matches sourcemaps per emitted JS file. Keep `uiSourceMap` and bytecode debug payloads as sibling debug documents inside the unified container instead of overloading the standard sourcemap top-level shape.
