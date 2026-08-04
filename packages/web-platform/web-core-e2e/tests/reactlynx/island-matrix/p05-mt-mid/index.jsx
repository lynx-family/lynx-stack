import { MainThread, root } from '@lynx-js/react';
import { BTReady, Header, Island } from '../parts.jsx';

// The island sits inside the tree, with ordinary content around it.
root.render(
  <page>
    <Header id='p05' />
    <MainThread>
      <Island id='p05' />
    </MainThread>
    <BTReady id='p05' />
  </page>,
);
