---
"@lynx-js/react-rsbuild-plugin": patch
---

Honor `splitChunks`, `performance.chunkSplit` and `output.sourceMap` when they are set on an environment. `pluginReactLynx` used to read them from the root of the config only when deciding whether to split chunks and whether to inline sources into source maps.
