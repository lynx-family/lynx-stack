// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  return (
    <view>
      {/* Basic rpx transformation in inline styles */}
      <view
        id='basic-rpx'
        style='width: 100rpx; height: 50rpx; margin: 10rpx;'
      >
        Basic RPX
      </view>

      {/* Mixed units with rpx */}
      <view
        id='mixed-units'
        style='width: 200rpx; padding: 10px 5rpx 15px 20rpx; border: 1px solid red;'
      >
        Mixed Units
      </view>

      {/* Negative rpx values */}
      <view
        id='negative-rpx'
        style='margin: -10rpx; transform: translateX(-50rpx);'
      >
        Negative RPX
      </view>

      {/* Decimal rpx values */}
      <view
        id='decimal-rpx'
        style='width: 100.5rpx; height: 50.25rpx; margin: 1.5rpx;'
      >
        Decimal RPX
      </view>

      {/* RPX with !important */}
      <view
        id='important-rpx'
        style='width: 150rpx !important; height: 75rpx !important;'
      >
        Important RPX
      </view>

      {/* Complex rpx values */}
      <view
        id='complex-rpx'
        style='margin: 5rpx 10rpx 15rpx 20rpx; padding: 8rpx 12rpx; border-radius: 4rpx;'
      >
        Complex RPX
      </view>

      {/* RPX in background position and size */}
      <view
        id='background-rpx'
        style='background-size: 100rpx 50rpx; background-position: 10rpx 20rpx;'
      >
        Background RPX
      </view>

      {/* Zero rpx values */}
      <view
        id='zero-rpx'
        style='margin: 0rpx; padding: 0rpx;'
      >
        Zero RPX
      </view>
    </view>
  );
}

root.render(
  <page>
    <App />
  </page>,
);
