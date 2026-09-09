import { useState } from '@lynx-js/react'

export interface CounterProps {
  initialCount?: number
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount)

  return (
    <view bindtap={() => setCount(count + 1)}>
      <text>{`Count: ${count}`}</text>
    </view>
  )
}
