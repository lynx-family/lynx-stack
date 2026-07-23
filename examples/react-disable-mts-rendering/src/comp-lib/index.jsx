import { useState } from '@lynx-js/react';

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
