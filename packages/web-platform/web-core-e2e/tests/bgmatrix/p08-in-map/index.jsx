import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

const items = ['x', 'y'];

root.render(
  <page>
    {items.map((it) => (
      <Background key={it} fallback={<Sk id={it} />}>
        <Real id={it} />
      </Background>
    ))}
  </page>,
);
