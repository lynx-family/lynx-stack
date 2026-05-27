---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Preserve the `dev.assetPrefix` path segment when building the dev `debugMetadataUrl`. Previously only the URL origin was kept, so dev servers behind a non-root base path (e.g. `https://host:<port>/assets/`) pointed `debug-metadata.json` at the wrong route and 404'd — now the emitted URL matches the rewritten `.map` sourceMappingURL.
