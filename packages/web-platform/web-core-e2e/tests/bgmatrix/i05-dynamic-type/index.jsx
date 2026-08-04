import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

const Boundary = String(Date.now() > 0) === 'true' ? Background : 'view';

root.render(
  <page>
    <Boundary fallback={<Sk id='a' />}>
      <Real id='a' />
    </Boundary>
  </page>,
);
