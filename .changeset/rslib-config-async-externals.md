---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Support async externals in `defineExternalBundleRslibConfig`. An external can now use the object form `{ libraryName, async: true }` to emit a `promise` external, so importing modules await the library namespace mounted as a Promise by the host application and pick subpath segments after it resolves.

The output library type also switches from Rslib's default `commonjs-static` to `commonjs2`, so an async entry exports its namespace Promise as a whole instead of a static per-name copy that would read `undefined`. A sync entry exports the same namespace object as before.
