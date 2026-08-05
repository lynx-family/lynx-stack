import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

root.render(
  <page>
    <Background
      fallback={
        <Background fallback={<Sk id='inner' c='#e3d5c9' />}>
          <Real id='never' />
        </Background>
      }
    >
      <Real id='a' />
    </Background>
  </page>,
);
