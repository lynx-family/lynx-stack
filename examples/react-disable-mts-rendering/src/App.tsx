import { useState } from '@lynx-js/react';

import Counter from './comp-lib/index.jsx';

console.info('[side-effect] App module evaluated');

export function App() {
  const [tick, setTick] = useState(0);

  return (
    <view style={{ padding: '24px' }}>
      <text style={{ fontSize: '20px' }}>
        Rendered by the background thread
      </text>
      <view bindtap={() => setTick(tick + 1)} style={{ marginTop: '12px' }}>
        <text>{`tick: ${tick}`}</text>
      </view>
      {
        /* `Counter` comes from a `sideEffects: false` library and is only
        * rendered by the background thread — its snapshots still reach the
        * main-thread bundle through the build-time collection. */
      }
      {__MAIN_THREAD__ ? null : <Counter />}
    </view>
  );
}
