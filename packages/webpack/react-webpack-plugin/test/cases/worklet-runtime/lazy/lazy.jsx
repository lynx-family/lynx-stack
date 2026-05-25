export default function Lazy() {
  const onTapMT = () => {
    'main thread';
  };

  return (
    <view>
      <text bindtap={onTapMT}>lazy worklet</text>
    </view>
  );
}
