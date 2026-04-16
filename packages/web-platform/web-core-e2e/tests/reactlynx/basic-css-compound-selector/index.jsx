// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

function App() {
  return (
    <view class='wrapper'>
      <view class='a b' style={{ width: '100px', height: '100px' }} />
      <view class='a' style={{ width: '100px', height: '100px' }} />
      <view class='b' style={{ width: '100px', height: '100px' }} />
    </view>
  );
}

root.render(<App></App>);
