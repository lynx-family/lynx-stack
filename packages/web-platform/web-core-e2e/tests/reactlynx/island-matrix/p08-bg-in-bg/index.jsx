import { Background, root } from '@lynx-js/react';
import { BTReady, Deferred, Skeleton } from '../parts.jsx';

// Nested opt-outs: the outer fallback is what the first frame shows.
root.render(
  <page>
    <Background fallback={<Skeleton id='p08-outer' />}>
      <Background fallback={<Skeleton id='p08-inner' />}>
        <Deferred id='p08' />
      </Background>
    </Background>
    <BTReady id='p08' />
  </page>,
);
