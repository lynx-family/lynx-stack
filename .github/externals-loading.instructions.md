---
applyTo: "packages/webpack/externals-loading-webpack-plugin/**"
---

External bundle URL resolvers and section loaders are serialized into each runtime realm. Keep callbacks independent of build-time closures, preserve synchronous loading for fixed URLs, and wrap native callback-only `fetchBundle` handlers in a Promise before chaining asynchronous work. Validate observable module exports and rejected imports using emitted bundles.
