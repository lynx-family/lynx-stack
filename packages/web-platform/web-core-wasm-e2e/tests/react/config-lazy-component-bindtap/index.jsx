// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

export default function App() {
  const [color, setColor] = useState('green');
  const handleTap = () => {
    setColor(color === 'green' ? 'pink' : 'green');
  };

  return (
    <view style={{ display: 'flex', flexDirection: 'row' }}>
      <view
        style={{ width: '100px', height: '100px', backgroundColor: color }}
        id='target1'
      >
      </view>
      <view
        style={{ width: '100px', height: '100px', backgroundColor: 'blue' }}
        bindtap={handleTap}
        id='target2'
      >
      </view>
    </view>
  );
}
