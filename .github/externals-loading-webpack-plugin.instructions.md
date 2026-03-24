---
applyTo: "packages/webpack/externals-loading-webpack-plugin/**"
---

Keep `ExternalsLoadingPlugin` focused on consuming finalized `externals` maps and generating runtime loading code. Do not bake project-specific preset expansion or filesystem-backed dev serving into this low-level plugin; those concerns belong in higher-level Rsbuild integrations such as `pluginExternalBundle`. It is acceptable for this low-level plugin to resolve a relative `bundlePath` against the runtime `publicPath`, because that stays within generic bundler/runtime behavior instead of Rspeedy-specific URL inference.
