---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Derive the debug-metadata release key from the chunk's module content — a SHA-1 (40-hex, git-parity) over the sorted module identifiers plus the chunk name and hash — instead of the bundler's 64-bit `chunk.hash`. Two apps can no longer share a release when their `chunk.hash` collides, without any `uniqueName`/`bid` to configure. The runtime banner is now injected at `processAssets` (so it can read the chunk graph) rather than via `BannerPlugin`.
