---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Harden dev `debugMetadataUrl` derivation from `dev.assetPrefix`:

- Preserve the path segment of `dev.assetPrefix` (previously only the URL origin was kept), so dev servers behind a non-root base path (e.g. `https://host:<port>/assets/`) resolve `debug-metadata.json` at the same route as the rewritten `.map` `sourceMappingURL` instead of 404'ing.
- Stop throwing when `dev.assetPrefix` is `false` (the supported same-origin config). The dev URL is now skipped gracefully, matching how the core sourcemap plugin treats `assetPrefix === false`.
