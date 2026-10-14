---
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Preserve the original TypeScript sources from published React runtime source maps when bundling the runtime on both the main and background threads. Main and lazy output maps retain runtime and worklet locations alongside per-chunk release metadata.
