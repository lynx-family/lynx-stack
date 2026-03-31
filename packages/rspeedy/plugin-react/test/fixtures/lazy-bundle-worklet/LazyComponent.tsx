export default function LazyComponent() {
  const onTap = () => {
    'main thread'
  }

  return (
    <view>
      <text main-thread:bindtap={onTap}>LazyComponent</text>
    </view>
  )
}
