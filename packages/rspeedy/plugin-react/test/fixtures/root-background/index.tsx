import { Background, root } from '@lynx-js/react'

const marker = 'root-background-business-marker'

console.info(marker)

function App(): JSX.Element {
  return (
    <view>
      <text>rendered by the background</text>
    </view>
  )
}

root.render(
  <Background
    fallback={
      <view className='skeleton'>
        <text>root-background-skeleton-marker</text>
      </view>
    }
  >
    <App />
  </Background>,
)
