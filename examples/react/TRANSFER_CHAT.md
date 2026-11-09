# Native transfer chat proof of concept

This example runs one shared LynxView, with each message mounted as a real
`transfer-view` in a native Android chat row. The composer and scroll container
are native; message text and bubble backgrounds are rendered by ReactLynx.
Replies are deterministic local streams, not calls to a model or external chat
service. Each bubble also has its own `useState` counter: tap anywhere on the
bubble to increment the `Count` shown at the bottom.

## Package split

Business code registers components through `@lynx-js/react-transfer`:

```tsx
import { TransferRegistry } from '@lynx-js/react-transfer';

TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);
```

The package owns the transfer registry, native protocol, instance generations,
props versions, ordered commit delivery and ACK queues. It coordinates
per-instance lifecycle and hydration through the renderer factories. Diagnostics
are available separately from
`@lynx-js/react-transfer/experimental/diagnostics`.

`@lynx-js/react-transfer` uses exactly two new factories from the peer renderer's
existing `@lynx-js/react/internal` entry:

- `createMainThreadRenderer` provides `initialize`, `createRoot` (returning
  `render` and `destroy`), and `applyCommit`.
- `createBackgroundRenderer` provides `createRoot` (returning `render`, `hydrate`,
  and `destroy`), `getCurrentRoot`, `flushEvents`, and `dispose`.

ReactLynx owns first-frame rendering, hydration, patch application, Preact hooks
and native event handling. Underlying Snapshot instances and raw patch
queues/managers stay inside ReactLynx. There is no separate renderer extension
entry, and the React runtime contains no transfer protocol. Business code only
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
- The companion creates a stable transfer container. The main-thread renderer
  renders the compiled component into a private per-instance Snapshot root and
  returns its first-frame snapshot for the companion to send to BTS.
- The background renderer owns an independent Preact container per bubble.
  Initial UI commits are gated until per-instance hydration against the MTS
  snapshot.
- Normal updates and ACKs use ContextProxy events, with a per-instance ordered
  queue owned by the companion. The main-thread renderer applies commits through
  the shared patch executor and native Page; raw patch queues stay private.
- The background renderer installs native event handlers independently of
  ordinary page hydration, so `bindtap` can trigger per-instance `useState`
  updates. The companion calls `flushEvents` after hydration to retry events
  whose snapshot handlers were not ready.
- The background renderer installs the independent commit hook, replacing the
  ordinary page hook installed by bootstrap. Preact hooks and event handlers stay
  inside ReactLynx, and its internal entry does not import the transfer package.
- Business code calls `TransferRegistry.registerComponent(name, provider)`.
  The first registration initializes the page-bound protocol listeners and
  renderer factories; later registrations reuse them. Native commands create
  instances through the renderer root wrappers. Business code receives no render
  context, and hydration has no artificial delay.

Read diagnostic data with `Runtime.evaluate` on the appropriate thread:

```js
JSON.stringify(globalThis.transferChatDebug);
```

It records actual component executions, versions, phases and commit sequences.
The object is diagnostic data, not an Engine protocol entry point.

## Verification

The recorded Android emulator run imported `@lynx-js/react-transfer` through its
package entry using the earlier Engine command route. Native taps incremented the first bubble twice and the second once,
producing independent counts of 2 and 1. BTS render counts changed from [1, 1]
to [3, 2]; MTS counts stayed [1, 1].

Sending `Package refactor streaming check` created two more real transfer nodes.
The completed reply reached props version 42 and commit sequence 42, with its
final ACK applied. BTS render counts were [3, 2, 1, 42], confirming that streaming
updated only the reply. Every MTS component rendered once. Native DOM inspection,
thread diagnostics, protocol logs and screenshots agreed. Clear removed all four
transfer nodes and marked every instance disposed on both threads.

The recorded prototype validation included the full Stack build, repository type
checks, source lint and API report generation. The complete Snapshot suite passed
1,044 tests with one existing skip and four todo tests; ElementTemplate passed
958 tests. Both suites reached 100% statement, branch, function and line coverage,
including the companion package in the Snapshot suite. This run used the existing
ARM64 Explorer build. These recorded results do not validate the current Native
command listeners or the two-factory renderer boundary; both require a fresh
validation run with the migrated native sender.

## Limits

This is an internal snapshot-backend experiment, not a released SDK API. The
native handles are local to Explorer. It exercises text bubbles, scoped props,
first-frame/hydration, event commits, ACKs and destruction. It does not certify
arbitrary worklets/refs, ElementTemplate, lazy-component IFR, template reload,
shared-runtime multi-page ownership, or production list virtualization. The
prototype uses existing global patch infrastructure at controlled commit
boundaries; those general cases need further isolation and testing before
publishing a general-purpose runtime API.
