// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';
import './index.css';

function App() {
  return (
    <view className='page'>
      <view
        id='grid-lanes'
        className='grid-lanes'
        lynx-test-tag='grid-lanes'
      >
        <view id='item-a' className='item item-a' lynx-test-tag='item-a' />
        <view id='item-b' className='item item-b' lynx-test-tag='item-b' />
        <view id='item-c' className='item item-c' lynx-test-tag='item-c' />
      </view>
      <view id='grid' className='grid'>
        <view className='item item-a' />
        <view className='item item-b' />
      </view>
    </view>
  );
}

root.render(<App />);
