import { Background, MainThread, root } from '@lynx-js/react';
import { BTReady, Deferred, Island, Skeleton } from '../parts.jsx';

// The proposed way out of `p06`, written by hand: name the island in *both*
// arms of the boundary, at the same position. The main thread renders the
// fallback arm and builds the island; the background renders the children arm
// and builds the same island at the same index, so the first-screen diff
// matches it by type and adopts it — the deferred sibling next to it is the
// only thing replaced.
const island = (
  <MainThread>
    <Island id='p12' />
  </MainThread>
);

root.render(
  <page>
    <Background
      fallback={
        <>
          {island}
          <Skeleton id='p12' />
        </>
      }
    >
      <>
        {island}
        <Deferred id='p12' />
      </>
    </Background>
    <BTReady id='p12' />
  </page>,
);
