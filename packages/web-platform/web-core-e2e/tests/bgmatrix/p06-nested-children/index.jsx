import { Background, root } from '@lynx-js/react';
import { Sk } from './sk.jsx';
import { Inner } from './Inner.jsx';

root.render(
  <page>
    <Background fallback={<Sk id='outer' />}>
      <Inner />
    </Background>
  </page>,
);
