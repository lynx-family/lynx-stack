import { MainThread, root } from '@lynx-js/react'

import { Shell } from './Shell.js'

root.render(
  <MainThread
    fallback={
      <view className='skeleton'>
        <text>root-main-thread-fallback-marker</text>
      </view>
    }
  >
    <Shell />
  </MainThread>,
)
