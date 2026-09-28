import { root } from '@lynx-js/react'

function App() {
  const onTap = () => {
    'main thread'
  }

  return <view bindtap={onTap}>main-thread programmability</view>
}

root.render(<App />)
