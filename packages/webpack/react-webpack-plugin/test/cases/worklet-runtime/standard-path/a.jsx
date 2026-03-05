export function a2() {
  const onTapMT = () => {
    'main thread';
  };

  return (
    <view>
      <text bindtap={onTapMT}>
        hello world
      </text>
    </view>
  );
}
