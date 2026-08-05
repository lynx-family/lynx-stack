import { Background, root } from '@lynx-js/react';
import { BTReady, Skeleton } from '../parts.jsx';
import { DeferredWithIsland } from '../nested.jsx';

// The island is inside the subtree the boundary defers — the case the fold
// cannot reach, because the main thread never walks in there to find it.
root.render(
  <page>
    <Background fallback={<Skeleton id='p06' />}>
      <DeferredWithIsland id='p06' />
    </Background>
    <BTReady id='p06' />
  </page>,
);
