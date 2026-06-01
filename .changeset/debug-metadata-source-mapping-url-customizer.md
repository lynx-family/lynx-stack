---
"@lynx-js/debug-metadata-rsbuild-plugin": minor
---

Expose `rewriteSourceMappingURLTrailers` and `RewriteSourceMappingURLTrailersOptions` from `@lynx-js/debug-metadata-rsbuild-plugin`. Consumers can now invoke the rewriter from their own `beforeEncode` tap and pass a `getSourceMappingURL` callback to customize the per-asset URL — e.g. point each chunk's trailer at a server-side filtered gateway endpoint (`https://.../raw?tos_key=<digest>&field=source-map&path=<mapPath>`) instead of the default container URL `${debugMetadataUrl}?field=source-map&path=...` form. Internally factors out `rewriteTrailerToUrl` as the trailer-replacement primitive that both the default and override paths share.
