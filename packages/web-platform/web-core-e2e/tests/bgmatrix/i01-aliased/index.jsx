import { Background as B, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

root.render(
  <page>
    <B fallback={<Sk id='a' />}>
      <Real id='a' />
    </B>
  </page>,
);
