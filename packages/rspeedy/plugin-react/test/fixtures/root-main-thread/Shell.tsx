import { Background } from '@lynx-js/react'

import { Feed } from './Feed.js'

export function Shell() {
  // Body code, not markup: it reaches the main thread only because this
  // module is compiled for the main thread. A snapshot definition would
  // carry the elements but not this.
  console.info('root-main-thread-body-marker')

  const onTap = (): void => {
    'main thread'
    console.info('root-main-thread-worklet-marker')
  }

  return (
    <view className='page'>
      <text main-thread:bindtap={onTap}>root-main-thread-island-marker</text>
      <Background fallback={<view className='feed-skeleton' />}>
        <Feed />
      </Background>
    </view>
  )
}
