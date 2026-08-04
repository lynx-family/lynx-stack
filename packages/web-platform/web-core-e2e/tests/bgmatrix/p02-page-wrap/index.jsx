import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

root.render(
  <page>
    <Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </Background>
  </page>,
);
