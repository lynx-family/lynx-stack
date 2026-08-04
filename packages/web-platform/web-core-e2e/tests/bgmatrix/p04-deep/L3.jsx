import { Background } from '@lynx-js/react';
import { Real } from './real.jsx';
import { Sk } from './sk.jsx';
export function L3() {
  return (
    <Background fallback={<Sk id='a' />}>
      <Real id='a' />
    </Background>
  );
}
