# react-reload-template-leak

Repro for elements retained across `reloadTemplate`.

The page mounts an `<input>` after the first screen, so every reload tears that
subtree down and builds a new one. `input` is used because it stands out by tag
in a trace or in `Memory.getAllMemoryUsage`.

## Run

```bash
pnpm dev            # Snapshot runtime
pnpm dev:et         # Element Template runtime
pnpm dev:rc         # add `disableQuickTracingGC`, the mode the leak needs
```

Open the page in LynxExplorer and tap **auto reload x20**, or drive it from
DevTool:

```js
NativeModules.LynxTestModule.reloadTemplate({ round: 1 }, {});
```

## What to look for

Count the live `input` elements — `Memory.getAllMemoryUsage` reports them per
instance under `viewDetail`, and a trace shows one
`FiberElement::Constructor` per reload with no matching destructor.

With the leak present the count grows by one per reload; when the replaced tree
is released it stays at one, without waiting for a GC.
