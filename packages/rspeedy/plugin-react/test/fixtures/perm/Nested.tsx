import { Background } from '@lynx-js/react'
import { DeferredG } from './DeferredG.js'
import { Skeleton } from './Skeleton.js'
export function Nested(): JSX.Element {
  return (
    <view>
      <text>MK_G_SHELL_RENDERS</text>
      <Background fallback={<Skeleton />}>
        <DeferredG />
      </Background>
    </view>
  )
}
