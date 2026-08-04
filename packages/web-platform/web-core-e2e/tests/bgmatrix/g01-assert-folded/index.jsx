import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

// The boundary and the reference to the deferred subtree are in the same
// module, so the fold can cut it — and `real.jsx`'s assertion holds.
root.render(
  <page>
    <Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </Background>
  </page>,
);
