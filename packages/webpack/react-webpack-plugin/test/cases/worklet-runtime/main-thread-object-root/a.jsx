import { useCounter } from './library.js';

export function a2() {
  const counter = useCounter(0);
  const onTapMT = () => {
    'main thread';
    counter.value += 1;
  };
  const onLongPressMT = () => {
    'main thread';
    counter.value = 0;
  };

  return (
    <view>
      <text bindtap={onTapMT} bindlongpress={onLongPressMT}>
        hello world
      </text>
    </view>
  );
}
