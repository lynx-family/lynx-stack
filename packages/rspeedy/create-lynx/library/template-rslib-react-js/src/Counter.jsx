import { useState } from '@lynx-js/react';

import './Counter.css';

export function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  return (
    <view className="Counter">
      <text className="Counter-count">{`Count: ${count}`}</text>
      <view className="Counter-button" bindtap={() => setCount(count + 1)}>
        <text className="Counter-buttonText">+1</text>
      </view>
    </view>
  );
}
