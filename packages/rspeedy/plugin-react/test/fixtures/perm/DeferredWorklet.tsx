console.info('MK_J_WORKLET_TOPLEVEL')
export function DeferredWorklet(): JSX.Element {
  const onTap = (): void => {
    'main thread'
    console.info('MK_J_WORKLET_BODY')
  }
  return (
    <view main-thread:bindtap={onTap}>
      <text>MK_J_LOGIC</text>
    </view>
  )
}
