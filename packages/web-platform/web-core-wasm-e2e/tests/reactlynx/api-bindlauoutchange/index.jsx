// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
function App() {
  const [color, setColor] = useState('pink');
  const handleLayoutChange = (e) => {
    if (
      e.detail.top === 50 && e.detail.bottom === 150 && e.detail.left === 50
      && e.detail.right === 150 && e.detail.width === 100
      && e.detail.height === 100
    ) {
      setColor('green');
    }
  };

  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        style={{
          width: '100px',
          height: '100px',
          backgroundColor: 'green',
          margin: '50px',
        }}
        bindLayoutChange={handleLayoutChange}
      >
      </view>
      <view
        style={{ width: '100px', height: '100px', backgroundColor: color }}
        id='target'
      >
      </view>
    </view>
  );
}
root.render(
  <page>
    <App></App>
  </page>,
);
