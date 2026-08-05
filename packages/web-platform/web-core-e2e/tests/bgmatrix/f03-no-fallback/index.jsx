import { Background, root } from '@lynx-js/react';
import { Header } from './header.jsx';
import { Real } from './real.jsx';

root.render(
  <page>
    <Header />
    <Background>
      <Real id='a' />
    </Background>
  </page>,
);
