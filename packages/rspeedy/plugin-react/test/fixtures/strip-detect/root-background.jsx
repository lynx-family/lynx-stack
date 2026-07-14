import { Background, root } from '@lynx-js/react'

import { App } from './App.jsx'

root.render(
  <Background
    fallback={
      <view>
        <text>Loading…</text>
      </view>
    }
  >
    <App />
  </Background>,
)
