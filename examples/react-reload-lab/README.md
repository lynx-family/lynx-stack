# ReactLynx reload lab

A small device example for `experimental_reEvalJSOnReload`. It checks that app
state and module-local state restart, main-thread event bindings remain usable,
and callback refs attach to the reloaded tree. It also shows a main-thread
Element PAPI mutation that persists across reload while React state resets.

## Run

```sh
pnpm --filter @lynx-js/example-react-reload-lab dev
```

Open the QR code in LynxExplorer. The client must expose
`NativeModules.LynxTestModule.reloadTemplate`; without it, the reload control
reports that the module is unavailable.

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
   reset, and the callback ref should return to `attached`. The MTS label stays
   **tapped**: direct Element PAPI mutations are outside React state and are not
   reset by reload (a current limitation).
4. Repeat reload several times, then tap the background and MTS → BTS controls
   again. Each tap should update its counter once, with no stale event handler
   or ref.
5. After each reload, tap **SHOW LOG** in Element PAPI trace. It captures the
   create, update, insert, remove and flush calls for that cycle and keeps the
   last three reloads for comparison.
