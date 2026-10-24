import { runOnBackground, useState } from '@lynx-js/react';

export function Repro() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    runOnBackground(() => {
      'background only';
      setCount(value => value + 1);
    })();
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}
