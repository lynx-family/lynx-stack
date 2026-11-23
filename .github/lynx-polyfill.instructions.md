---
applyTo: "packages/rspeedy/**"
---

Rspeedy defaults `output.polyfill` to `off`. When polyfills are enabled, keep core-js out of ReactLynx compilation and preserve the user's SWC exclusions. The Chrome 92 target is a compatibility approximation for automatic builtin selection, not a guarantee that every Lynx runtime has Chrome's APIs.

The Lynx Rsbuild plugin also runs directly under Rsbuild, so refer to the plugin rather than Rspeedy in its diagnostics.

When executing both Lynx thread bundles in a VM test, expose the same mock `lynx` globally and to the background `tt.define` factory, with its `Promise` taken from the VM context.
