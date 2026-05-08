// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
function App() {
  const [color, setColor] = useState('pink');
  const handleTouchStart = (e) => {
    const detailOk = typeof e.detail.x === 'number'
      && typeof e.detail.y === 'number'
      && e.detail.x > 0 && e.detail.x < 200
      && e.detail.y > 0 && e.detail.y < 200;
    const touch = e.touches && e.touches[0];
    const touchOk = touch
      && typeof touch.clientX === 'number' && typeof touch.clientY === 'number'
      && touch.clientX > 0 && touch.clientX < 200
      && touch.clientY > 0 && touch.clientY < 200
      // pageX/pageY mirror clientX/clientY in lynx-view-relative space.
      && touch.pageX === touch.clientX
      && touch.pageY === touch.clientY;
    if (detailOk && touchOk) {
      setColor('green');
    }
  };

  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        style={{
          width: '100px',
          height: '100px',
          backgroundColor: 'blue',
          margin: '50px',
        }}
        bindtouchstart={handleTouchStart}
        id='touch-area'
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
