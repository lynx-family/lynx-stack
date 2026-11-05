# Native transfer chat proof of concept

This example runs one shared LynxView, with each message mounted as a real
`transfer-view` in a native Android chat row. The composer and scroll container
are native; message text and bubble backgrounds are rendered by ReactLynx.
Replies are deterministic local streams, not calls to a model or external chat
service.

## Build and run

From the Lynx Stack repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm turbo build
```

The example is generated at `examples/react/dist/transfer-chat.lynx.bundle`.
Explorer must be built from the sibling Lynx checkout with `TransferChatHost`
and the reserved Engine-event command route.

From the Lynx repository root:

```sh
source tools/envsetup.sh
tools/hab sync .
cd explorer/android
../../tools/env.sh ./gradlew :LynxExplorer:assembleWithoutSparklingNoasanDebug \
  -PabiList=arm64-v8a -Pbuild_showcase=false --no-daemon
adb -s emulator-5556 install -r lynx_explorer/build/outputs/apk/withoutSparklingNoasan/debug/LynxExplorer-withoutSparkling-noasan-debug.apk
```

From the workspace containing both repositories, keep the server running:

```sh
python3 -I -m http.server 3081 --bind 127.0.0.1 \
  --directory lynx-stack/examples/react/dist
```

```sh
adb -s emulator-5556 reverse tcp:3081 tcp:3081
adb -s emulator-5556 shell am start \
  -n com.lynx.explorer/.LynxViewShellActivity \
  --es url 'http://127.0.0.1:3081/transfer-chat.lynx.bundle?transfer_chat=true'
```

The local simulator uses software rendering:

```sh
emulator -avd Pixel_9_Reeval -port 5556 -no-snapshot \
  -gpu swiftshader_indirect -feature -Vulkan
```

## Actual path

- The native controller submits reserved commands through the existing
  `sendGlobalEventToLepus` JNI transport. The local engine adapter dispatches
  those three names as Engine events; no new global JS callbacks are used.
- MTS creates a stable transfer container, renders the compiled component into
  a per-instance Snapshot root, flushes it, and emits its snapshot to BTS.
- BTS owns an independent Preact container per bubble. Initial UI commits are
  gated until per-instance hydration against the MTS snapshot.
- Normal updates and ACKs use ContextProxy events, with a per-instance ordered
  queue. The shared main-thread patch executor and native Page are reused.
- The demo deliberately delays hydration by 800ms to expose the first frame and
  exercise updates that arrive before ownership handoff.

Read diagnostic data with `Runtime.evaluate` on the appropriate thread:

```js
JSON.stringify(globalThis.transferChatDebug);
```

It records actual component executions, versions, phases and commit sequences.
The object is diagnostic data, not an Engine protocol entry point.

## Verification

The interactive simulator run created four real transfer nodes. During the
local streamed answer, the updating bubble had 39 BTS renders; the other three
remained at one render each. Every MTS component remained at one render. Native
Clear removed all four views and completed background unmounts. A screenshot
captured the new user bubble before the delayed hydration completed.

The complete Stack build and ARM64 Explorer build passed. The targeted commit,
hydration and ref regression suite passed 66 tests with one existing skip.

## Limits

This is an internal snapshot-backend experiment, not a released SDK API. The
native handles are local to Explorer. It exercises text bubbles, scoped props,
first-frame/hydration, event commits, ACKs and destruction. It does not certify
arbitrary worklets/refs, ElementTemplate, lazy-component IFR, template reload,
shared-runtime multi-page ownership, or production list virtualization. The
prototype uses existing global patch infrastructure at controlled commit
boundaries; those general cases need further isolation and testing before
publishing a general-purpose runtime API.
