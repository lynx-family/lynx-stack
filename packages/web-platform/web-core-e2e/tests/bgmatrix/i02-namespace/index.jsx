import * as ReactLynx from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

ReactLynx.root.render(
  <page>
    <ReactLynx.Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </ReactLynx.Background>
  </page>,
);
