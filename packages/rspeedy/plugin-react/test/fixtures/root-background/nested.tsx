import { Background, root } from '@lynx-js/react'

// `<Background>` is used, but NOT at the render root: it keeps meaning
// per-subtree runtime deferral and must not turn the whole-program mode on.
function App(): JSX.Element {
  return (
    <view>
      <text>header-on-the-first-screen</text>
      <Background fallback={<text>feed-skeleton</text>}>
        <text>feed-from-the-background</text>
      </Background>
    </view>
  )
}

root.render(<App />)
