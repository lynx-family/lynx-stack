import { Background, root } from '@lynx-js/react';
import { BTReady, Deferred, Island, Skeleton } from '../parts.jsx';

// `p12`, written with the API instead of by hand. The boundary names the
// island, and both threads render it ahead of their own arm — so the author
// writes it once and cannot put the two copies out of step.
root.render(
  <page>
    <Background
      island={<Island id='p13' />}
      fallback={<Skeleton id='p13' />}
    >
      <Deferred id='p13' />
    </Background>
    <BTReady id='p13' />
  </page>,
);
