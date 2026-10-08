export default function Lazy() {
  const onTap = () => {
    'main thread';
  };

  return <view bindtap={onTap}>lazy main-thread programmability</view>;
}
