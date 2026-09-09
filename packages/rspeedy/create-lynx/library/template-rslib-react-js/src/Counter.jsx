import { useState } from '@lynx-js/react'

export function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount)

  return (
    <view bindtap={() => setCount(count + 1)}>
      <text>{`Count: ${count}`}</text>
    </view>
  )
}
