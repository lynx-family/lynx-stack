import { root } from '@lynx-js/react';
import { Background } from './boundary.js';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

root.render(
  <page>
    <Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </Background>
  </page>,
);
