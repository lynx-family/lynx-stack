import { Background, root } from '@lynx-js/react'

import { FeedC } from './FeedC.js'

// `<Background>` is not at the render root: it defers one subtree while the
// header around it stays on the first screen.
function App(): JSX.Element {
  return (
    <view>
      <text>header-on-the-first-screen</text>
      <Background fallback={<text>feed-skeleton</text>}>
        <FeedC />
      </Background>
    </view>
  )
}

root.render(<App />)
