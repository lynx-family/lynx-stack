// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

import { current, next } from './palette.js' with { runtime: 'shared' };

function App() {
  return (
    <view style={{ height: '200px', width: '100px' }}>
      <view
        id='target'
        main-thread:bindTap={(event) => {
          'main thread';
          event.currentTarget.setStyleProperty('background-color', next());
        }}
        style={{ height: '100px', width: '100px', background: 'pink' }}
      />
      <view
        id='observer'
        main-thread:bindTap={(event) => {
          'main thread';
          event.currentTarget.setStyleProperty('background-color', current());
        }}
        style={{ height: '100px', width: '100px', background: 'pink' }}
      />
    </view>
  );
}
root.render(<App />);
