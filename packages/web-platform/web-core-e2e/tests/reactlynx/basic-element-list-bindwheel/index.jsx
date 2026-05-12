// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [eventType, setEventType] = useState('');

  const handleWheel = (e) => {
    if (e.type === 'wheel') {
      setEventType(e.type);
    }
  };

  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <list
        id='target'
        list-type='single'
        style={{ width: '240px', height: '240px', backgroundColor: 'yellow' }}
        bindwheel={handleWheel}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <list-item
            key={index}
            item-key={`${index}`}
            style={{ width: '100%', height: '100px', backgroundColor: 'white' }}
          >
            <text>{index}</text>
          </list-item>
        ))}
      </list>
      <text id='result'>{eventType}</text>
      <view
        id='indicator'
        style={{
          width: '100px',
          height: '100px',
          backgroundColor: eventType === 'wheel' ? 'green' : 'pink',
        }}
      />
    </view>
  );
}

root.render(<App />);
