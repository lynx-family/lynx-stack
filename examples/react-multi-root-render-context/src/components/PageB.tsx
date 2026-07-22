import { useState } from '@lynx-js/react';

import { addClick, initCount, store } from '../Shared.js';

export function PageB() {
  const [, setTick] = useState(0);

  const onTap = () => {
    addClick();
    setTick((t) => t + 1);
  };

  return (
    <view style={{ flex: 1, backgroundColor: '#0f1a14', padding: '96px 24px' }}>
      <text style={{ color: '#7ce38b', fontSize: '28px' }}>Page B</text>
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
          backgroundColor: '#7ce38b',
          borderRadius: '8px',
          alignSelf: 'flex-start',
        }}
      >
        <text style={{ color: '#000', fontSize: '16px' }}>+1 from B</text>
      </view>
    </view>
  );
}
