import { onlyA } from './OnlyA.js'
import { shared } from './Shared.js'
console.info('MK_A1_OWN_TOPLEVEL')
function aBody(): string {
  return 'MK_A_BODY_LOGIC'
}
export function DeferredA(): JSX.Element {
  return (
    <view>
      <text>{aBody() + onlyA() + shared()}</text>
    </view>
  )
}
