import { root } from '@lynx-js/react';
import { Deferred } from './Deferred.jsx';
import { Real } from './real.jsx';

root.render(
  <page>
    <Deferred id='a'>
      <Real id='a' />
    </Deferred>
  </page>,
);
