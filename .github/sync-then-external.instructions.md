---
applyTo: "examples/react-externals/**,packages/webpack/externals-loading-webpack-plugin/**"
---

When testing synchronous external cache hits, instrument the module startup boundary as well as the first native render. A final screenshot cannot prove that module initialization completed before startup returned. Keep synchronous fetchBundle mocks separate from the actual loader and verify genuinely pending completion too. Preserve native Promise scheduling for unrelated application code.
