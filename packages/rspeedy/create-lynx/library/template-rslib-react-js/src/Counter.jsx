import { useState } from '@lynx-js/react';

export function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  return (
    <view
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderRadius: '16px',
        backgroundColor: '#f1f3f8',
      }}
    >
      <text style={{ fontSize: '18px', fontWeight: '600', color: '#1f2329' }}>
        {`Count: ${count}`}
      </text>
      <view
        bindtap={() => setCount(count + 1)}
        style={{
          padding: '8px 18px',
          borderRadius: '999px',
          backgroundColor: '#3370ff',
        }}
      >
        <text style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff' }}>
          +1
        </text>
      </view>
    </view>
  );
}
