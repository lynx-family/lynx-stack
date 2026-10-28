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

The server uses port `54175` and advertises a local IPv4 address for lazy bundle
URLs. Override these with `RELOAD_LAB_PORT` and `RELOAD_LAB_HOST` when needed.
For an Android emulator using `adb reverse`, set `RELOAD_LAB_HOST=127.0.0.1`
and reverse the configured port.

Open the QR code in LynxExplorer. The client must expose
`NativeModules.LynxTestModule.reloadTemplate`; without it, the reload control
reports that the module is unavailable. Background entry re-evaluation also
requires the client app to provide `reloadCard`; otherwise its existing reload
behavior is retained.

### Build modes

One config handles both backends and reload modes. Snapshot with entry
re-evaluation is the default. Set `RELOAD_LAB_ET=true` for Element Template
and `RELOAD_LAB_REEVAL=false` for ordinary reload:

| Backend          | Entry re-evaluation | Environment                                  |
| ---------------- | ------------------- | -------------------------------------------- |
| Snapshot         | On                  | Default                                      |
| Snapshot         | Off                 | `RELOAD_LAB_REEVAL=false`                    |
| Element Template | On                  | `RELOAD_LAB_ET=true`                         |
| Element Template | Off                 | `RELOAD_LAB_ET=true RELOAD_LAB_REEVAL=false` |

For example:

```sh
RELOAD_LAB_ET=true pnpm --filter @lynx-js/example-react-reload-lab dev
```

These variables work with both `dev` and `build`. Restart the server or rebuild
after changing modes. All builds write to `dist`.
List checks are hidden in ET mode until the client supports ET List; the other
reload, data, globalProps, event and ref controls remain available.

## Native globalProps checks

This example uses reactive globalProps and the native test module APIs. The
latest `reloadLabGlobalPropsTick` is shown as `YYYY-MM-DD HH:mm:ss.SSS`, or
`Not set` before the first update.

1. Tap **Update native globalProps**. The displayed time should update without
   resetting either counter.
2. Tap **Native props + reloadTemplate**. The native update and reload are called
   consecutively; the page should keep the timestamp and reset React state.
   Module-local counters restart only with entry re-evaluation enabled.
3. Tap **reloadTemplate with globalProps**. The timestamp is passed directly to
   the native reload API and should stay visible after reload.
4. Repeat both reload controls. Ref attachment invokes `boundingClientRect`;
   native selector errors expose stale refs if an old root remounts.

These controls require `NativeModules.LynxTestModule.updateGlobalProps` and
`reloadTemplate`. They leave destruction to the native reload lifecycle and do
not call the JS app's update or destruction callbacks directly.

## Manual checks

1. Tap **Increment background state**. Both counters should increase once.
2. Tap **MTS state: idle**. Its label should change to **MTS state: tapped**.
3. Tap **RELOAD**. React state should reset and the callback ref should return
   to `attached`. With entry re-evaluation enabled, the runtime epoch advances
   and module-local counters restart. With `RELOAD_LAB_REEVAL=false`, the epoch
   and module-local values persist: after one tap before reload, the next
   **Increment background state** tap shows React state `1` and module count `2`.
   With Snapshot, the MTS label stays **tapped**: direct Element PAPI mutations are outside React
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
   the lazy counter should reset to zero with entry re-evaluation enabled. With
   `RELOAD_LAB_REEVAL=false`, it starts from the retained module count and
   continues incrementing. Tap the **Background-only card** again to check its
   main-thread worklet still runs.

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
**Reload with dataCnt +1** followed by **Reload with dataCnt only (+1)**: both counters
should advance together, and the retained field should remain set. **Reload
with empty data** should preserve both counters and the retained field.

## Diagnostic entries

The same server also serves these focused pages:

| Bundle                                  | Check                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `main-thread-object-reload.lynx.bundle` | Read factory and entry generations before and after reload. New objects must use the new generation.             |
| `stale-background-callback.lynx.bundle` | Reload while an old main-thread ref cleanup sends a background call. It must not reach the new page.             |
| `stale-main-thread-return.lynx.bundle`  | Hold a real old return until a new call returns. The displayed fresh result must not be replaced by the old one. |

Use `RELOAD_LAB_REEVAL=false` to run the diagnostic entries with ordinary reload.
They share the main page's config and output directory.

For the old-return entry, tap **Start call and reload**, wait for the new
generation, then tap **Read fresh result after reload**. Confirm both `held`
and `flushing old return`
messages in the main-thread console. The fresh result alone does not prove
that an old reply was delivered. For the callback entry, check the ref
unmount log as well; a backend that skips ref cleanup does not exercise it.

The Element PAPI interceptor is a diagnostic tool; its trace is not a runtime
performance benchmark.

## Known limitations

ET main-thread-to-background event calls can reproduce
[issue #4195](https://github.com/lynx-family/lynx-stack/issues/4195):
`FinalizationRegistry.prototype.register: target must be an object`. The bridge
control is intentionally kept as a diagnostic case and is marked in the ET UI.
Run the other checks before this control, or reopen the page after the error.
Do not count this case as passing just because other reload checks pass.

ET List is not exercised by this example. Snapshot retains direct Element PAPI
mutations across reload; ET retains only the page root and rebuilds its children.

On the tested Android LynxExplorer/DevTool build, the ET Element PAPI control
also triggers a native crash in `liblynxdevtool.so`, including without the
animation. This is separate from #4195. Snapshot is the default for the complete
manual checklist; ET diagnostics must report these failures separately rather
than claiming full coverage.
