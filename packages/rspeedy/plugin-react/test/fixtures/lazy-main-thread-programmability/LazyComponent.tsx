export default function LazyComponent() {
  const onTap = () => {
    'main thread'
  }

  return <view bindtap={onTap}>lazy main-thread programmability</view>
}
