import { useState } from '@lynx-js/react';

import Counter from './comp-lib/index.jsx';

console.info('MODULE_SIDE_EFFECT_MARKER');

export function App() {
  const [count, setCount] = useState(0);
  const onScrollMT = (e) => {
    'main thread';
    console.info(e);
  };

  return (
    <view main-thread:bindscroll={onScrollMT}>
      <text bindtap={() => setCount(count + 1)}>{count}</text>
      {__MAIN_THREAD__ ? null : <Counter />}
    </view>
  );
}
