---
"@lynx-js/rspeedy": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Express the SWC compilation baseline through `env` (a high `targets` plus an explicit `include` transform list) instead of `jsc.target`. The emitted build output is unchanged for existing projects.

Because `env` and `jsc.target` are mutually exclusive in SWC, `tools.swc.jsc.target` is no longer accepted and now throws a clear error. To downlevel specific syntax, add the corresponding transforms to `tools.swc.env.include` instead — they are merged on top of the per-layer baseline.
