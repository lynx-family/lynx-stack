import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

const props = { fallback: <Sk id='a' /> };

root.render(
  <page>
    <Background {...props}>
      <Real id='a' />
    </Background>
  </page>,
);
