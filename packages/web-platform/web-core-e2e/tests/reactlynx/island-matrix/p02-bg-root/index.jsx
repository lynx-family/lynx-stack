import { Background, root } from '@lynx-js/react';
import { BTReady, Deferred, Skeleton } from '../parts.jsx';

// The whole app is deferred; the first frame is the fallback.
root.render(
  <page>
    <Background fallback={<Skeleton id='p02' />}>
      <Deferred id='p02' />
    </Background>
    <BTReady id='p02' />
  </page>,
);
