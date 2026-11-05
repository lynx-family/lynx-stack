---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
"@lynx-js/debug-metadata": patch
---

Fix `remapUiTree` resolving a UI node to a source location a consumer could not turn into a link back to the file: `uiSourceMap.sources` is now relative to the repository root instead of an absolute build-machine path, and `UiSourceLocation` / `RemappedUiNode` gain `remoteUrl` and `commit` alongside the host-less `repo`.
