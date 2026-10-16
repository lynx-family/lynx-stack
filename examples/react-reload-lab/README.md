# ReactLynx reload lab

A small device example for `experimental_reEvalJSOnReload`. It checks that app
state and module-local state restart, main-thread event bindings remain usable,
and callback refs attach to the reloaded tree. It also shows a main-thread
Element PAPI mutation that persists across Snapshot reload while React state resets.
Element Template reload rebuilds the page children and resets that mutation.

## Run

```sh
pnpm --filter @lynx-js/example-react-reload-lab dev
```

Open the QR code in LynxExplorer. The client must expose
`NativeModules.LynxTestModule.reloadTemplate`; without it, the reload control
reports that the module is unavailable.

### Element Template

Snapshot is the default. To enable Element Template with entry re-evaluation:

```sh
RELOAD_LAB_ET=true pnpm --filter @lynx-js/example-react-reload-lab dev
```

The same variable works with `build`. Restart the dev server after changing it.
List checks are hidden in ET mode until the client supports ET List; the other
reload, data, globalProps, event and ref controls remain available.

## Native globalProps checks

This example uses reactive globalProps and the native test module APIs. The
latest `reloadLabGlobalPropsTick` is shown as `YYYY-MM-DD HH:mm:ss.SSS`, or
`Not set` before the first update.

1. Tap **Update native globalProps**. The displayed time should update without
   resetting either counter.
2. Tap **Native props + reloadTemplate**. The native update and reload are called
   consecutively; the new runtime should keep the timestamp and reset its counters.
3. Tap **reloadTemplate with globalProps**. The timestamp is passed directly to
   the native reload API and should stay visible after re-evaluation.
4. Repeat both reload controls. Ref attachment invokes `boundingClientRect`;
   native selector errors expose stale refs if an old root remounts.

These controls require `NativeModules.LynxTestModule.updateGlobalProps` and
`reloadTemplate`. They leave destruction to the native reload lifecycle and do
not call the JS app's update or destruction callbacks directly.

## Manual checks

1. Tap **Increment background state**. Both counters should increase once.
2. Tap **MTS state: idle**. Its label should change to **MTS state: tapped**.
3. Tap **RELOAD**. The runtime epoch should advance, React counters should
   reset, and the callback ref should return to `attached`. With Snapshot, the
   MTS label stays **tapped**: direct Element PAPI mutations are outside React
   state and are not reset by reload (a current limitation). With Element
   Template, the label returns to **idle** because reload retains the page root
   but removes and rebuilds its children.
4. Repeat reload several times, then tap the background and MTS → BTS controls
   again. Each tap should update its counter once, with no stale event handler
   or ref.
5. After each reload, tap **SHOW LOG** in Element PAPI trace. It captures the
   create, update, insert, remove and flush calls for that cycle and keeps the
   last three reloads for comparison. ET logs include template creation,
   attribute updates, node insertion/removal and serialization. Expect child
   removal and creation in ET; Snapshot can reuse existing native nodes.
6. Scroll to **LazyComponent** and tap **counter +1**. After native reload,
   both the main and lazy bundle counters should reset to zero. Tap the
   **Background-only card** again to check its main-thread worklet still runs.

The `reloadLab::main-bundle-eval` and `reloadLab::lazy-bundle-eval` trace slices
mark module counter initialization. They indicate module factory execution,
which can happen again even when core reuses cached lazy bundle exports.

## List reload checks

The **List reload** section uses a native single-column list with 40 keyed rows
and a shared reuse identifier. Scroll to later rows and tap them; **Selected**
and **Taps** should update once per tap. Use **Reverse** and **Remove first** to
check keyed updates. Tap its **Reload** button, wait at least 12 seconds, and
check that all 40 rows return in their original order, selection and tap count
reset, and visible and recycled rows still respond to taps. Scroll offset is
not asserted by this example.

## Reload data checks

**Native reload data** displays `dataCnt` from `useInitData()` on the background
thread and from a main-thread ref callback reading `lynx.__initData`. Use
**Reload with dataCnt +1** followed by **Update dataCnt only (+1)**: both counters
should advance together, and the retained field should remain set. **Reload
with empty data** should preserve both counters and the retained field.
