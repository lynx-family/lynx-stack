# react-lazy-bundle-split-repro

Minimal reproduction for [#4040](https://github.com/lynx-family/lynx-stack/issues/4040):
chunk splitting misbehaves when two lazy bundles import the same module.

`src/PageA.tsx` and `src/PageB.tsx` are lazy-loaded from `src/index.tsx` and both
import `src/shared.ts`, which they use from the background layer (JSX children)
and from the main-thread layer (a `'main thread'` worklet). The cache group in
`rsbuild.config.js` puts `src/shared.ts` into a chunk named `shared`.

## Build modes

| script                    | cache group            | result                                     |
| ------------------------- | ---------------------- | ------------------------------------------ |
| `build:baseline`          | none (`NO_SPLIT=1`)    | works                                      |
| `build:split`             | unscoped               | builds, but the lazy bundles no longer run |
| `build:split-background`  | `layer: /background/`  | builds, every bundle gets bigger           |
| `build:split-main-thread` | `layer: /main-thread/` | build fails                                |

## What each mode shows

### `build:split` — one chunk for both layers, and it replaces the main thread

`dist/split/.lynx/lazy-bundle/src_PageA.tsx/background.<hash>.js` holds _both_
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
`dist/split/.lynx/lazy-bundle/*/tasm.json`, `lepusCode.root` is the 1232-byte
shared chunk instead of the bundle's own 1684-byte `main-thread.js`, and the
shared chunk is missing from `manifest`. Both bundles fail to load at runtime:

```
unhandled rejection: Lazy bundle load failed, schema: /lazy-bundle/src_PageA.tsx.<hash>.bundle
```

### `build:split-main-thread` — filename conflict

With the cache group restricted to the main-thread layer, the split chunk
contains only main-thread modules, so `getAsyncChunkLayoutName` maps it onto the
unhashed `main-thread.js` of whichever bundle it was attributed to:

```
× Conflict: Multiple assets emit different content to the same filename .lynx/lazy-bundle/src_PageA.tsx/main-thread.js
```

That is problem 2.

### `build:split-background` — splitting makes every bundle bigger

|                          | `src_PageA.tsx.bundle` | `src_PageB.tsx.bundle` |
| ------------------------ | ---------------------- | ---------------------- |
| `build:baseline`         | 17274 B                | 17279 B                |
| `build:split-background` | 18623 B                | 18628 B                |

Both bundles still contain their own copy of `SHARED_MODULE_BODY`, because
`LynxEncodePlugin` inlines every manifest chunk for a `DynamicComponent`. That is
problem 3: nothing is shared, and each bundle additionally pays for the
chunk-loading runtime.
