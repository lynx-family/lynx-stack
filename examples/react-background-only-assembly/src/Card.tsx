import { useState } from '@lynx-js/react';

// A small 'background only' component in its own module.
export function Card() {
  'background only';
  const [spins, setSpins] = useState(0);

  return (
    <view className='Card' bindtap={() => setSpins(spins + 1)}>
      <text className='Card__label'>Background-only card ({spins})</text>
    </view>
  );
}
