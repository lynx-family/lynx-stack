import { useState } from '@lynx-js/react';
export function Stateful({ id }) {
  const [n] = useState(2);
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from(
        { length: n },
        (_, i) => (
          <view
            key={i}
            id={`sk-${id}-${i}`}
            style={{
              width: '200px',
              height: '20px',
              margin: '3px',
              backgroundColor: '#c9d5e3',
            }}
          />
        ),
      )}
    </view>
  );
}
