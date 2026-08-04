import { Background, root } from '@lynx-js/react'

import { HeavyApp } from './HeavyApp.js'

root.render(
  <Background
    fallback={
      <view className='skeleton'>
        <text>root-background-skeleton-marker</text>
      </view>
    }
  >
    <HeavyApp />
  </Background>,
)
