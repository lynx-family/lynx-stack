import { Background, root } from '@lynx-js/react';
import { BTReady, Skeleton } from '../parts.jsx';
import { DeferredWithMarkedIsland } from '../marked.jsx';

// `p06` with the marker in place of the boundary. The marker compiles the
// island's *module* for the main thread; this case asks whether that is
// enough on its own, with the island still sitting inside a deferred subtree.
root.render(
  <page>
    <Background fallback={<Skeleton id='p11' />}>
      <DeferredWithMarkedIsland id='p11' />
    </Background>
    <BTReady id='p11' />
  </page>,
);
