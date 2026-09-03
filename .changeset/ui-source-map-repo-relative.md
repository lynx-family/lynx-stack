---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/debug-metadata": patch
---

Fix `remapUiTree` returning a UI node's source location that a consumer could not turn into a link back to the file.

- Emit `uiSourceMap.sources` relative to the repository root. The main-thread loader hands the collector absolute build-machine paths, so a resolved node came back with something like `/opt/build/src/.../apps/app/src/components/Badge/index.tsx` — a path that differs per builder and reaches no file. `sources` now carry what the type has always promised, an authored path relative to the project root.
- Add `remoteUrl` and `commit` to `UiSourceLocation` / `RemappedUiNode`. `repo` normalizes SSH and HTTP remotes to the same `owner/repo` string, which erases which host (or which internal vs. public mirror of the same path) `source` came from; `remoteUrl` and `commit` are what's needed to actually reach the file the build was compiled from.
