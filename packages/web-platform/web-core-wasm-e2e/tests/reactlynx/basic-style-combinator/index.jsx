// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view className='parent' style={{ width: '100px', height: '200px' }}>
      <view>
        <text></text>
      </view>
      <view id='target'>
        <text></text>
      </view>
    </view>
  );
}
root.render(<App></App>);
