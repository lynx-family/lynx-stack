# Native transfer chat proof of concept

This example runs one shared LynxView, with each message mounted as a
`transfer-view` in a native chat row. The composer and scroll container are
native; each bubble is a ReactLynx component. Tap a bubble to increment its own
`useState` counter.

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
- Commits and events before hydration are dropped. A failed commit disposes the
  component and sends `__TransferDisposed`.

## Build

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm turbo build
```

The bundle is generated at `examples/react/dist/transfer-chat.lynx.bundle`. It
needs a native host that sends the commands above through the Native
ContextProxy channel.

## Limits

This is an internal snapshot-backend experiment. It does not cover worklets,
ElementTemplate, lazy-component IFR, template reload or list virtualization.
