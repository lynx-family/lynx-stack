// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
import { Sub } from './sub';
function App() {
  return (
    <view class='a'>
      <view class='b' style={{ height: '100px', width: '100px' }}></view>
      <Sub />
    </view>
  );
}

root.render(<App></App>);
