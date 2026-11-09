# @lynx-js/react-transfer

Experimental transfer-view rendering for dedicated ReactLynx pages. Each native
message host owns an independent main-thread first frame and background component
tree in one shared LynxView.

```tsx
import { TransferRegistry } from '@lynx-js/react-transfer';

TransferRegistry.registerComponent('ChatBubble', () => ChatBubble);
```

The first registration initializes one private registry per page/thread. Native
commands create and destroy instances or replace their props. The package owns
the transfer registry and event protocol, instance generations, props versions,
ordered commit delivery and acknowledgements.
Local component state updates use the same per-instance commit path.

On MTS, `__CreateTransfer`, `__SetTransferProps`, and `__DestroyTransfer` are
client commands received through `lynx.getNative()`. Each event's `data` is the
command object, without an argument-array wrapper. `__RenderPage` remains an
Engine event. MTS/BTS protocol messages use the JS-context/core-context channels.

The renderer is a peer dependency. This package uses exactly two new factories
from the renderer's existing `@lynx-js/react/internal` entry:

- `createMainThreadRenderer` provides `initialize`, `createRoot` (returning
  `render` and `destroy`), and `applyCommit`.
- `createBackgroundRenderer` provides `createRoot` (returning `render`, `hydrate`,
  and `destroy`), `getCurrentRoot`, `flushEvents`, and `dispose`.

ReactLynx owns first-frame rendering, hydration, patch application, Preact hooks
and native event handling. Snapshot instances, raw patch queues/managers and hook
installers stay inside the renderer. The companion coordinates these renderers
through its protocol and ACK queues. It shares the application's ReactLynx and
Preact; it does not bundle another renderer. There is no separate renderer
extension entry, and ordinary pages do not import this package.

Optional fixture instrumentation lives at
`@lynx-js/react-transfer/experimental/diagnostics`. The package root only exports
`TransferRegistry`; business code only registers providers and never receives a
render context.

This private workspace package is an unreleased prototype requiring the companion
native transfer host and the renderer internal exports described above in this
checkout. The peer version range does not imply that an upstream release already
contains those exports. Only the Snapshot backend
and dedicated transfer pages are supported. ElementTemplate, lazy bundles,
template reload and general worklet/ref behavior are not certified.

See [the native chat fixture](../../examples/react/TRANSFER_CHAT.md) for setup,
native routing and interactive validation.
