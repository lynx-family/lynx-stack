import { useState } from '@lynx-js/react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <view
      className='button button-secondary'
      bindtap={() => setCount(count + 1)}
    >
      <text className='button-text'>{`count: ${count}`}</text>
    </view>
  );
}
