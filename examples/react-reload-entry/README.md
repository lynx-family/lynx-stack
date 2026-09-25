# Example: re-evaluate the main thread entry on reload

`reloadTemplate` reuses the JSX produced when the entry was first evaluated, so
module scoped state of the entry survives a reload. With
`experimental_reloadEntryReeval`, the bundler wraps the main thread entry and
the runtime re-runs it instead, which resets that state while the element tree
is still reused through the existing hydrate path.

`@lynx-js/react` has to stay outside the re-evaluated bundle, otherwise the
re-run replaces the framework's own `__root`, `__page` and snapshot registry.
This example therefore enables `pluginExternalBundle` for both variants.

## Build

```bash
pnpm build                       # dist/baseline, reuses the previous JSX
RELOAD_ENTRY_REEVAL=1 pnpm build # dist/reeval, re-evaluates the entry
```

## Run

Serve the output and open it in LynxExplorer:

```bash
python3 -m http.server 8412
adb reverse tcp:8412 tcp:8412
adb shell am start -n com.lynx.explorer/.DebugBridgeActivity \
  -a android.intent.action.VIEW \
  -d 'lynx://open?url=http%3A%2F%2F127.0.0.1%3A8412%2Fdist%2Freeval%2Fmain.lynx.bundle'
```

Tap `reloadTemplate`, or drive the main thread directly:

```bash
agent-lynx evaluate "updatePage({}, { reloadTemplate: true })" --thread main
```

`dist/baseline` keeps logging `main-thread entry eval #1`; `dist/reeval` counts
up on every reload, and `module value` returns to `0` while the rendered rows
keep their elements.
