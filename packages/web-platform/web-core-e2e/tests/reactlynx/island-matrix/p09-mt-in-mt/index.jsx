import { MainThread, root } from '@lynx-js/react';
import { BTReady, Header, Island } from '../parts.jsx';

// Nested opt-ins: the inner boundary is redundant, and must be harmless.
root.render(
  <page>
    <MainThread>
      <view style={{ display: 'flex', flexDirection: 'column' }}>
        <Header id='p09' />
        <MainThread>
          <Island id='p09' />
        </MainThread>
      </view>
    </MainThread>
    <BTReady id='p09' />
  </page>,
);
