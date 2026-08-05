import { formatFeed } from './heavy-format.js'
import { Widget } from './Widget.js'

export function Feed() {
  // Behind a `<Background>`, so the fold drops this whole module — and the
  // code it imports — from the main-thread bundle.
  console.info('root-main-thread-feed-body-marker')

  return (
    <view className='feed'>
      <text>root-main-thread-feed-marker</text>
      <text>{formatFeed('feed')}</text>
      <Widget />
    </view>
  )
}
