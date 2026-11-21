# ReactLynx Transfer

## Native Transfer Chat

This example runs one shared LynxView, with each message mounted as a
`transfer-view` in a native chat row. The composer and scroll container are
native; each bubble is a ReactLynx component. Tap a bubble to increment its own
`useState` counter, which resets when the bubble's props change.

## Runtime entry

```tsx
import { TransferRegistry } from '@lynx-js/react/internal';

TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);
```

Registering the first component turns the page into a transfer page:
`root.render` is ignored, and only components created by the native host render.

## Protocol

- Native sends `__CreateTransfer`, `__SetTransferProps` and `__DestroyTransfer`
  to the main thread through `lynx.getNative()`.
- The main thread renders the first frame into a `transfer-view`, forwards the
  commands and sends `__TransferFirstFrame` to the background thread.
- The background thread hydrates each component against its first frame, then
  sends `__TransferCommit` packets one at a time. The main thread applies each
  one and answers with `__TransferCommitResult`.
- Like a template reload, `__SetTransferProps` re-renders the component on both
  threads and re-syncs its first frame; component state resets. Commits carry a
  `version` that counts props updates, so commits for a replaced frame are
  dropped and `seq` restarts at 1.
- Commits and events before hydration are dropped. A failed commit disposes the
  component and sends `__TransferDisposed`.

## Build

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm turbo build --filter=@lynx-js/example-react-transfer
```

Both bundles are generated in `examples/react-transfer/dist`. Use the Android
Lynx Explorer Transfer playground to create and update their native views.

## Run in Android Explorer

Start the dev server from the workspace root.

```sh
corepack pnpm --filter @lynx-js/example-react-transfer dev --port 4411
adb reverse tcp:4411 tcp:4411
```

Open either bundle with the same Explorer playground option. For the chat demo,
replace `transfer-first-frame` in the URL with `transfer-chat`.

```sh
adb shell am start -W -n com.lynx.explorer/.LynxViewShellActivity \
  --es lynx_initial_url 'http://127.0.0.1:4411/transfer-first-frame.lynx.bundle?transferPlayground=true'
```

For the chat demo, create `ChatBubble` with
`{"role":"user","text":"Hello"}` and a second `ChatBubble` with
`{"role":"assistant","text":"Hi"}`. Tap the bubbles to change their counters.
Select a bubble and use **Set props** to replace its props and reset its counter.

## First-frame worklet regression

`transfer-first-frame` uses two native Transfer views. The demo holds A's first
frame while A renders again and B runs a post-hydration worklet. It also checks
main-thread refs after the native host updates A's props.

1. Create `FirstFrameWorklet` with `{"name":"A"}`, then create a second
   `FirstFrameWorklet` with `{"name":"B"}`.
2. Both cards show `Early worklet: ran`. In the `[transfer-first-frame]` logs,
   `A render 1 queued` precedes `B update ran`, which precedes
   `deliver A frame: 0`. The A render and layout worklets complete after that.
3. Select A and set its props to `{"name":"A","revision":1}` using **Set props**.
   A advances to revision 1 and logs
   `A render 0 ran: 1` and `A layout: 1 ran`. B stays at revision 0.
4. Tap **Subscribe (.on)** and **Select tab (.set)** in A. Both log success for
   revision 1. Tap **Run late worklet** to confirm post-hydration updates still
   complete.

## Limits

These are internal Snapshot examples. ElementTemplate, lazy-component IFR,
template reload and list virtualization are outside their scope.
