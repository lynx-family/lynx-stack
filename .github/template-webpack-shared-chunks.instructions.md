---
applyTo: "{packages/webpack/template-webpack-plugin/**,packages/webpack/css-extract-webpack-plugin/test/hot-update-encode-options.test.ts,packages/webpack/css-extract-webpack-plugin/test/fixtures/hot-update-encode-options/**}"
---

When testing CSS hot updates with lazy bundles that share a chunk, import two distinct lazy pages and place their common CSS in an explicit `splitChunks` cache group. Importing one page twice under different names does not emit the shared async CSS hot-update asset after the template plugin filters chunks by lazy-bundle ownership. Assert the shared asset's default async path.

A named `splitChunks` cache group is not itself a lazy bundle. Keep lazy-template assets, intermediate chunk layout, and the `lynx_aci` runtime map aligned: chunks shared by distinct lazy pages use default async loading, while different import paths resolving to the same module still count as one lazy bundle. Check the runtime map as well as emitted files; a build can pass while a native page remains stuck on its loading fallback.
