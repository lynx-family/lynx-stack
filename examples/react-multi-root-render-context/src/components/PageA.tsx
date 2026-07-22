import { useState } from '@lynx-js/react';

import { addClick, initCount, store } from '../Shared.js';

export function PageA() {
  const [, setTick] = useState(0);

  const onTap = () => {
    addClick();
    setTick((t) => t + 1);
  };

  return (
    <view style={{ flex: 1, backgroundColor: '#101014', padding: '96px 24px' }}>
      <text style={{ color: '#61dafb', fontSize: '28px' }}>Page A</text>
      <text style={{ color: '#fff', fontSize: '20px', marginTop: '24px' }}>
        shared store.clicks = {store.clicks}
      </text>
      <text style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
        store initCount = {initCount} (expect 1 in a shared context)
      </text>
      <view
        bindtap={onTap}
        style={{
          marginTop: '24px',
          padding: '12px 24px',
          backgroundColor: '#61dafb',
          borderRadius: '8px',
          alignSelf: 'flex-start',
        }}
      >
        <text style={{ color: '#000', fontSize: '16px' }}>+1 from A</text>
      </view>
    </view>
  );
}
