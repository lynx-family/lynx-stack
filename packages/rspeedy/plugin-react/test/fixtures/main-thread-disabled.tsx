import { root } from '@lynx-js/react'

const marker = 'business-only-marker'

console.info(marker)

function App(): JSX.Element {
  return (
    <view>
      <text>rendered by the background</text>
    </view>
  )
}

root.render(
  <page>
    <App />
  </page>,
)
