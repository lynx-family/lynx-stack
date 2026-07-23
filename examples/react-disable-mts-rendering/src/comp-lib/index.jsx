import { useState } from '@lynx-js/react';

// This "library" sets `sideEffects: false` (see package.json next to it).
// Its snapshot registrations still reach the main-thread bundle because they
// are collected from the compiled module instead of the JS module graph.
export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <view style={{ marginTop: '12px' }}>
      <view bindtap={() => setCount(count + 1)}>
        <text>{`count: ${count}`}</text>
      </view>
    </view>
  );
}
