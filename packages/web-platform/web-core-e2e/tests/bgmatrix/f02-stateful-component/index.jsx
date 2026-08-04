import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Stateful } from './Stateful.jsx';

root.render(
  <page>
    <Background fallback={<Stateful id='a' />}>
      <Real id='a' />
    </Background>
  </page>,
);
