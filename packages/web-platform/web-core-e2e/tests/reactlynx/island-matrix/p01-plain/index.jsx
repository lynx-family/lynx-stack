import { root } from '@lynx-js/react';
import { BTReady, Header, Island } from '../parts.jsx';

// No boundary anywhere. Under `enableMTSRendering: true` the whole tree is
// main-thread code; under `false` the entry declares nothing for the main
// thread to render, so the first frame is empty. The control for both ends.
root.render(
  <page>
    <Header id='p01' />
    <Island id='p01' />
    <BTReady id='p01' />
  </page>,
);
