console.info('MK_E_SLOTTED_TOPLEVEL')
function eBody(): string {
  return 'MK_E_BODY_LOGIC'
}
export function Slotted(): JSX.Element {
  'background only'
  return (
    <view>
      <text>{eBody()}</text>
    </view>
  )
}
