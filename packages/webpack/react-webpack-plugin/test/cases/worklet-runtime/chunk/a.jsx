export function a2() {
  const onTapMT = () => {
    'main thread';
  };
  const onLongPressMT = () => {
    'main thread';
  };

  return (
    <view>
      <text
        bindtap={onTapMT}
        bindlongpress={onLongPressMT}
      >
        hello world
      </text>
    </view>
  );
}
