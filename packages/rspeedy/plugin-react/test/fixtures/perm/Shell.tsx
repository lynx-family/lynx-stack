import { shared } from './Shared.js'
export function Shell(): JSX.Element {
  return (
    <view>
      <text>MK_SHELL_RENDERS{shared()}</text>
    </view>
  )
}
