import { MainThread, root } from '@lynx-js/react'

import { Plain } from './Plain.js'

root.render(
  <MainThread
    fallback={
      <view className='skeleton'>
        <text>root-main-thread-fallback-marker</text>
      </view>
    }
  >
    <Plain />
  </MainThread>,
)
