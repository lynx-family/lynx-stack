import * as ReactLynx from '@lynx-js/react';

export function a2() {
  const [count] = ReactLynx.useState(0);
  const onTapMT = () => {
    'main thread';
  };
  const onLongPressMT = () => {
    'main thread';
  };

  return (
    <view>
      <text bindtap={onTapMT} bindlongpress={onLongPressMT}>
        hello world {count}
      </text>
    </view>
  );
}
