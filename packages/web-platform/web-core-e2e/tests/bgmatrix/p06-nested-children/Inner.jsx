import { Background } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';
export function Inner() {
  return (
    <view>
      <Real id='a' />
      <Background fallback={<Sk id='b' c='#d5c9e3' />}>
        <Real id='b' c='#6f2fd0' />
      </Background>
    </view>
  );
}
