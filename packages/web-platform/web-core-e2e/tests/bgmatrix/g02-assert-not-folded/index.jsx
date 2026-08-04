import { root } from '@lynx-js/react';
import { Deferred } from './Deferred.jsx';
import { Real } from './real.jsx';

// Same shape as `i04-wrapper`, where the fold cannot cut the reference: the
// boundary is inside `Deferred`, the reference is here in `children`. There
// the loss is silent; here `real.jsx` imports 'background-only', so the build
// says so instead.
root.render(
  <page>
    <Deferred id='a'>
      <Real id='a' />
    </Deferred>
  </page>,
);
