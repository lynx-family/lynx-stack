---
"@lynx-js/rspeedy": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Express the SWC compilation baseline through `env` (a high `targets` plus an explicit `include` transform list) instead of `jsc.target`. The emitted build output is unchanged for existing projects.

Because `env` and `jsc.target` are mutually exclusive in SWC, `tools.swc.jsc.target` is no longer accepted and now throws a clear error. To downlevel specific syntax, add the corresponding transforms to `tools.swc.env.include` instead — they extend the base/background baseline (the main thread keeps its fixed es2019 baseline, matching the previous `jsc.target` behavior).
