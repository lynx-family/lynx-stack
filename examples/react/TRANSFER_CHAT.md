# Native transfer chat proof of concept

This example runs one shared LynxView, with each message mounted as a real
`transfer-view` in a native Android chat row. The composer and scroll container
are native; message text and bubble backgrounds are rendered by ReactLynx.
Replies are deterministic local streams, not calls to a model or external chat
service. Each bubble also has its own `useState` counter: tap anywhere on the
bubble to increment the `Count` shown at the bottom.

## Runtime entry

Business code registers components through the existing `@lynx-js/react/internal` entry:

```tsx
import { TransferRegistry } from '@lynx-js/react/internal';

TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);
```

The registry lives in `@lynx-js/react` runtime and owns the native protocol, ordered commit delivery and ACK queues. Diagnostics are exported as
`transferDiagnostics` from the same entry.

It builds on two renderer factories in the same entry:

- `createMainThreadRenderer` provides `initialize`, `createRoot` (returning
  `render` and `destroy`), and `applyCommit`.
- `createBackgroundRenderer` provides `createRoot` (returning `render`, `hydrate`,
  and `destroy`), `getCurrentRoot`, `flushEvents`, and `dispose`.

ReactLynx owns first-frame rendering, hydration, patch application, Preact hooks
and native event handling. Underlying Snapshot instances and raw patch
queues/managers stay inside ReactLynx. There is no separate renderer extension
entry. Business code only
registers component providers and never receives a render context.

## Build and run

From the Lynx Stack repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm turbo build
```

The example is generated at `examples/react/dist/transfer-chat.lynx.bundle`.
Explorer requires `TransferChatHost` to send commands through the Native
ContextProxy channel. The sibling checkout's prototype host still uses
`sendGlobalEventToLepus` and an Engine-event adapter; that sender must be migrated
before the fixture can run with the current Native listeners. The device results
below were recorded with the earlier Engine command route.

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

- The client sends `__CreateTransfer`, `__SetTransferProps`, and
  `__DestroyTransfer` to MTS through the Native ContextProxy channel, listened to
  with `lynx.getNative()`. Each event's `data` is the command object, without an
  argument-array wrapper. Page initialization still listens for the Engine's
  `__RenderPage` event.
- The registry creates a stable transfer container. The main-thread renderer
  renders the compiled component into a private per-instance Snapshot root and
  returns its first-frame snapshot for the registry to send to BTS.
- The background renderer owns an independent Preact container per bubble.
  Initial UI commits are gated until per-instance hydration against the MTS
  snapshot.
- Normal updates and ACKs use ContextProxy events, with a per-instance ordered
  queue owned by the registry. The main-thread renderer applies commits through
  the shared patch executor and native Page; raw patch queues stay private.
- The background renderer installs native event handlers independently of
  ordinary page hydration, so `bindtap` can trigger per-instance `useState`
  updates. The registry calls `flushEvents` after hydration to retry events
  whose snapshot handlers were not ready.
- The background renderer installs the independent commit hook, replacing the
  ordinary page hook installed by bootstrap. Preact hooks and event handlers stay
  inside ReactLynx.
- Business code calls `TransferRegistry.registerComponent(name, provider)`.
  The first registration initializes the page-bound protocol listeners and
  renderer factories; later registrations reuse them. Native commands create
  instances through the renderer root wrappers. Business code receives no render
  context, and hydration has no artificial delay.

Read diagnostic data with `Runtime.evaluate` on the appropriate thread:

```js
JSON.stringify(globalThis.transferChatDebug);
```

It records actual component executions, phases and commit sequences.
The object is diagnostic data, not an Engine protocol entry point.

## Limits

This is an internal snapshot-backend experiment, not a released SDK API. The
native handles are local to Explorer. It exercises text bubbles, scoped props,
first-frame/hydration, event commits, ACKs and destruction. It does not certify
arbitrary worklets/refs, ElementTemplate, lazy-component IFR, template reload,
shared-runtime multi-page ownership, or production list virtualization. The
prototype uses existing global patch infrastructure at controlled commit
boundaries; those general cases need further isolation and testing before
publishing a general-purpose runtime API.
