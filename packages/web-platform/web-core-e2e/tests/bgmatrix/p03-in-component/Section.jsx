import { Background } from '@lynx-js/react';
import { Header } from './header.jsx';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';

export function Section() {
  return (
    <view>
      <Header />
      <Background fallback={<Sk id='a' />}>
        <Real id='a' />
      </Background>
    </view>
  );
}
