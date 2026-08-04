import { Background } from '@lynx-js/react'
import { FeedC } from './FeedC.js'
import { SkeletonC } from './SkeletonC.js'
function middleLogic(): string {
  return 'middle-not-deferred-logic'
}
export function Middle(): JSX.Element {
  return (
    <view>
      <text>{middleLogic()}</text>
      <Background fallback={<SkeletonC />}>
        <FeedC />
      </Background>
    </view>
  )
}
