import { Background, root } from '@lynx-js/react'

// `<Background>` is used, but NOT at the render root — it is a partial opt-out
// nested inside the app. The whole-program strip must NOT be auto-detected here.
function App() {
  return (
    <view>
      <text>Header renders on the first screen</text>
      <Background fallback={<text>Loading…</text>}>
        <Feed />
      </Background>
    </view>
  )
}

root.render(<App />)
