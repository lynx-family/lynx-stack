export default function LazyBundleComp() {
  const onTap = () => {
    'main thread'
  }

  return (
    <view bindtap={onTap}>
      <text>lazy bundle comp</text>
    </view>
  )
}
