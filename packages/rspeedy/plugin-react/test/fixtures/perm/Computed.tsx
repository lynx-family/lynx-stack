console.info('MK_F_COMPUTED_TOPLEVEL')
function fBody(): string {
  return 'MK_F_BODY_LOGIC'
}
export function Computed(): JSX.Element {
  return (
    <view>
      <text>MK_F_WRAP</text>
    </view>
  )
}
export function ComputedInner(): JSX.Element {
  'background only'
  return (
    <view>
      <text>{fBody()}</text>
    </view>
  )
}
