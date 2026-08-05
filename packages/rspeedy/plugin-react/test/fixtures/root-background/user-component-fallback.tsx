import { Background, root } from '@lynx-js/react'

function spinnerLabel(): string {
  return 'spinner-from-fallback-logic'
}

function Spinner(): JSX.Element {
  return (
    <view>
      <text>{spinnerLabel()}</text>
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
