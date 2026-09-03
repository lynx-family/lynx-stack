---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Emit `uiSourceMap.sources` relative to the repository root. The main-thread loader hands the collector absolute build-machine paths, so a UI node resolved through `remapUiTree` came back with something like `/opt/build/src/.../apps/app/src/components/Badge/index.tsx` — a path that differs per builder and reaches no file. `sources` now carry what the type has always promised, an authored path a consumer can join onto the build's git remote and commit.
