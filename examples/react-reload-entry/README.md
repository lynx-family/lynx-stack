# Example: re-evaluate the entry on reload

`reloadTemplate` reuses the JSX produced when the entry was first evaluated, so
module scoped state of the entry survives a reload. With
`experimental_reloadEntryReeval`, both threads evaluate their entry again
instead, which resets that state while the element tree is still reused through
the existing hydrate path.

The two threads get there differently. On the main thread the bundler wraps the
entry and the runtime re-runs the wrapper, so `@lynx-js/react` has to stay
outside that bundle - otherwise the re-run replaces the framework's own
`__root`, `__page` and snapshot registry. This example therefore enables
`pluginExternalBundle` for both variants.

On the background thread the framework hands reload back to Lynx core, which
drops the app and loads the card again. Nothing framework-side is on the stack
when that happens, so app-service.js and the bundles it pulls in are all
evaluated again. This needs a Lynx core that installs its own `onAppReload`;
older ones leave the background on the re-render path while the main thread
still re-evaluates.

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

`dist/baseline` keeps logging `entry eval #1` on both threads. `dist/reeval`
counts up on every reload, on the main thread and - given a core that supports
it - on the background thread too.

The `entry eval #` and `module value` on screen settle on the background
thread's copies, since the background render is what survives hydration. They
are the ones to watch: they only move once the background entry is re-evaluated
as well, and `module value` returning to `0` there is what says the reload
actually reset the state the app mutates.
