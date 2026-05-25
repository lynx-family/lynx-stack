export default function LazyBundleWithWorklet() {
  const onTapMT = () => {
    'main thread'
  }

  return (
    <view>
      <text bindtap={onTapMT}>Hello from lazy worklet bundle!</text>
    </view>
  )
}
