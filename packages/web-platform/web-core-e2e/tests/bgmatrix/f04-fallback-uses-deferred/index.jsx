import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';

root.render(
  <page>
    <Background fallback={<Real id='a' c='#c9d5e3' />}>
      <Real id='a' />
    </Background>
  </page>,
);
