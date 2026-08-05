import { Background, MainThread, root } from '@lynx-js/react'

import { Feed } from './Feed.js'
import { Header } from './Header.js'

// No boundary at the render root: the island sits inside the tree, next to a
// `<Background>` that defers the rest.
root.render(
  <view className='page'>
    <MainThread>
      <Header />
    </MainThread>
    <Background fallback={<view className='feed-skeleton' />}>
      <Feed />
    </Background>
  </view>,
)
