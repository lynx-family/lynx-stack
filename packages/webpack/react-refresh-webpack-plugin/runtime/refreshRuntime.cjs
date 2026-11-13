// @ts-nocheck
// Evaluated synchronously when an importing module runs (including before
// `await __rspack_async_deps` in an async-external wrapper) so async module
// continuations keep registering into the bundle that started loading them.
module.exports = typeof globalThis !== 'undefined'
    && typeof globalThis.$RefreshBind$ === 'function'
  ? globalThis.$RefreshBind$()
  : null;
