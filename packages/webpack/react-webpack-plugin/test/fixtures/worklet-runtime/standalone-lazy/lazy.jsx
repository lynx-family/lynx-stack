export default function StandaloneLazy() {
  const onTap = () => {
    'main thread';
  };

  return <view bindtap={onTap}>standalone lazy</view>;
}
