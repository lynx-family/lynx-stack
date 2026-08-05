import { Background, MainThread, root } from '@lynx-js/react';
import { BTReady, Deferred, Header, Island, Skeleton } from '../parts.jsx';

// Both boundaries, side by side, with plain content between them.
root.render(
  <page>
    <MainThread>
      <Island id='p10' />
    </MainThread>
    <Header id='p10' />
    <Background fallback={<Skeleton id='p10' />}>
      <Deferred id='p10' />
    </Background>
    <BTReady id='p10' />
  </page>,
);
