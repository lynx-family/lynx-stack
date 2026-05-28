---
"@lynx-js/debug-metadata": minor
---

Add a `remap` CLI and a matching `remapUiTree` API that reverse-resolve a Lynx UI node tree. Each node carrying a `nodeIndex` and a `debugMetadataUrl` is annotated with its source location (`repo`, `source`, `line`, `column`) from the embedded `uiSourceMap`; all other fields, and nodes that cannot be resolved, pass through unchanged.
