import { Background, MainThread, root } from '@lynx-js/react';
import { BTReady, Deferred, Island, Skeleton } from '../parts.jsx';

// Composition the other way round: an island that defers part of itself.
root.render(
  <page>
    <MainThread>
      <view style={{ display: 'flex', flexDirection: 'column' }}>
        <Island id='p07' />
        <Background fallback={<Skeleton id='p07' />}>
          <Deferred id='p07' />
        </Background>
      </view>
    </MainThread>
    <BTReady id='p07' />
  </page>,
);
