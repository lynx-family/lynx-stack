# react-lazy-bundle-share-common-chunks

Minimal reproduction for [#4040](https://github.com/lynx-family/lynx-stack/issues/4040):
chunk splitting misbehaves when two lazy bundles import the same module.

The failures below describe the behavior before the fixes in #4104 and #4079.

`src/PageA.tsx` and `src/PageB.tsx` are lazy-loaded from `src/index.tsx` and both
import `src/shared.ts`, which they use from the background layer (JSX children)
and from the main-thread layer (a `'main thread'` worklet). The cache group in
`rsbuild.config.ts` puts `src/shared.ts` into a chunk named `shared`.

## Run

```bash
pnpm build
pnpm dev # scan the QR code with LynxExplorer
```

The `shared` cache group is enabled by default. To compare with a build without
chunk splitting, remove `splitChunks` from `rsbuild.config.ts`; to try a
layer-specific split, add `layer: /background/` or `layer: /main-thread/` to
the cache group.

For a native device, set `REPRO_ASSET_PREFIX` to an absolute URL reachable by
the device before building (for example, `http://127.0.0.1:54173/` with an
`adb reverse` port forward). The default root-relative asset URLs are only
useful for inspecting the build output; the native loader cannot resolve them
against the main bundle's URL.

## What failed before the fixes

### Unscoped cache group — one chunk for both layers

`dist/.lynx/lazy-bundle/src_PageA.tsx/background.<hash>.js` held _both_
copies of `shared.ts` — the background one and the main-thread one:

```text
exports.modules = {
  PJ(e, r, t) {
    var a = 6 == t.j ? {} : null; /* ... */
  }, // react:background
  SP(e, r, t) {
    var a = 1 == t.j ? {} : null; /* ... */
  }, // react:main-thread
};
```

That is problem 1: `splitChunks.chunks` only excludes chunks whose name contains
`__main-thread`, and a lazy bundle's main-thread chunk has no such name.

The chunk is then picked as the lazy bundle's main-thread root. In
`dist/.lynx/lazy-bundle/*/tasm.json`, `lepusCode.root` was the 1232-byte
shared chunk instead of the bundle's own 1684-byte `main-thread.js`, and the
shared chunk is missing from `manifest`. Both bundles fail to load at runtime:

```
unhandled rejection: Lazy bundle load failed, schema: /lazy-bundle/src_PageA.tsx.<hash>.bundle
```

### `layer: /main-thread/` — filename conflict

With the cache group restricted to the main-thread layer, the split chunk
contains only main-thread modules, so `getAsyncChunkLayoutName` maps it onto the
unhashed `main-thread.js` of whichever bundle it was attributed to:

```
× Conflict: Multiple assets emit different content to the same filename .lynx/lazy-bundle/src_PageA.tsx/main-thread.js
```

That is problem 2.

### `layer: /background/` — splitting makes every bundle bigger

|                       | `src_PageA.tsx.bundle` | `src_PageB.tsx.bundle` |
| --------------------- | ---------------------- | ---------------------- |
| no `splitChunks`      | 17274 B                | 17279 B                |
| `layer: /background/` | 18623 B                | 18628 B                |

Both bundles still contain their own copy of `SHARED_MODULE_BODY`, because
`LynxEncodePlugin` inlines every manifest chunk for a `DynamicComponent`. That is
problem 3: nothing is shared, and each bundle additionally pays for the
chunk-loading runtime.
