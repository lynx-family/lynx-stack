import { Background, root } from '@lynx-js/react'

function Spinner(): JSX.Element {
  return (
    <view>
      <text>spinner</text>
    </view>
  )
}

function App(): JSX.Element {
  return (
    <view>
      <text>rendered by the background</text>
    </view>
  )
}

root.render(
  <Background fallback={<Spinner />}>
    <App />
  </Background>,
)
