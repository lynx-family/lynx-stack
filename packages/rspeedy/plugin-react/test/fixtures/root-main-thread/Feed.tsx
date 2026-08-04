import { formatFeed } from './heavy-format.js'

export function Feed(): JSX.Element {
  'background only'

  return (
    <view className='feed'>
      <text>root-main-thread-feed-marker</text>
      <text>{formatFeed('feed')}</text>
    </view>
  )
}
