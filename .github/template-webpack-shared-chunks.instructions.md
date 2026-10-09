---
applyTo: "{packages/webpack/template-webpack-plugin/**,packages/webpack/css-extract-webpack-plugin/test/hot-update-encode-options.test.ts,packages/webpack/css-extract-webpack-plugin/test/fixtures/hot-update-encode-options/**}"
---

When testing CSS hot updates with lazy bundles that share a chunk, import two distinct lazy pages and place their common CSS in an explicit `splitChunks` cache group. Importing one page twice under different names does not emit the shared async CSS hot-update asset after the template plugin filters chunks by lazy-bundle ownership. Assert the shared asset's default async path.
