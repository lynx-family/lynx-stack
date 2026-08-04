import { Background, root } from '@lynx-js/react';
import { Header } from './header.jsx';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

root.render(
  <page>
    <Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </Background>
    <Header />
    <Background fallback={<Sk id='b' c='#d5c9e3' />}>
      <Real id='b' c='#6f2fd0' />
    </Background>
  </page>,
);
