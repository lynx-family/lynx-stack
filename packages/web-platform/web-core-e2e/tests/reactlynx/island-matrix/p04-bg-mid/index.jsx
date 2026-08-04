import { Background, root } from '@lynx-js/react';
import { BTReady, Deferred, Header, Skeleton } from '../parts.jsx';

// First-screen header, deferred body.
root.render(
  <page>
    <Header id='p04' />
    <Background fallback={<Skeleton id='p04' />}>
      <Deferred id='p04' />
    </Background>
    <BTReady id='p04' />
  </page>,
);
