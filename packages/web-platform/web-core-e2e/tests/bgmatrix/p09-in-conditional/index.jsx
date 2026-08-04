import { Background, root } from '@lynx-js/react';
import { Header } from './header.jsx';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

const on = String(Date.now() > 0) === 'true';

root.render(
  <page>
    {on
      ? (
        <Background fallback={<Sk id='a' />}>
          <Real id='a' />
        </Background>
      )
      : <Header />}
  </page>,
);
