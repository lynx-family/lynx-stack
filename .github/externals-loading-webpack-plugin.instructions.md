---
applyTo: "packages/webpack/externals-loading-webpack-plugin/**"
---

Keep `ExternalsLoadingPlugin` focused on consuming finalized `externals` maps and generating runtime loading code. Do not bake project-specific preset expansion or filesystem-backed dev serving into this low-level plugin; those concerns belong in higher-level Rsbuild integrations such as `pluginExternalBundle`. It is acceptable for this low-level plugin to resolve a relative `bundlePath` against the runtime `publicPath`, because that stays within generic bundler/runtime behavior instead of Rspeedy-specific URL inference.

Keep synchronous and asynchronous section evaluation tied to module imports rather than runtime startup; prefetching a bundle must not eagerly execute its section before preceding synchronous initialization imports. Preserve host-injected exports and writable cached values, and defer shared-section aliases without triggering their primary loader during startup. Cache the Promise itself for asynchronous externals, including rejected Promises, so repeated or concurrent imports do not reload a section. Deferring imports does not serialize asynchronous sibling modules; an initializer that awaits another module needs an explicit dependency when its completion is required. Test actual execution order with the source plugin, including a component external imported after a local initializer.

Keep runtime-code generation choices in named local expressions rather than nested multiline template interpolations so source-level coverage can attribute their exercised branches. Validate coverage through the root Rstest configuration used by CI, and verify generated bundle output is unchanged when refactoring these expressions.

The plugin's source is covered by Rstest, not Vitest. Keep its exact source path excluded from Vitest's untested-file sweep: V8 otherwise reports zero-hit template interpolation and continuation lines that Istanbul does not consider executable, producing false misses when Codecov merges the reports. Do not exclude the source from Rstest coverage or lower the coverage threshold.

When external loading mode is selected at runtime, compile consuming externals with promise semantics in both branches and resolve subpath exports only after the namespace is available. Keep boolean configurations unchanged. Runtime predicates must be standalone functions without build-time closures, and ReactLynx external-bundle producers must await the mounted namespace as well.
