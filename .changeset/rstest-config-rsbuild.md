---
"@lynx-js/react": patch
---

`withLynxConfig()` now loads `rsbuild.config.*` in an Rsbuild project, not only `lynx.config.*` in an Rspeedy one, so Rstest runs in both.
