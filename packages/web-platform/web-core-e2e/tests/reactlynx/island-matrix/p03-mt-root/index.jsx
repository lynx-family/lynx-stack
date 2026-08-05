import { MainThread, root } from '@lynx-js/react';
import { BTReady, Island } from '../parts.jsx';

// The whole app is the island.
root.render(
  <page>
    <MainThread>
      <Island id='p03' />
    </MainThread>
    <BTReady id='p03' />
  </page>,
);
