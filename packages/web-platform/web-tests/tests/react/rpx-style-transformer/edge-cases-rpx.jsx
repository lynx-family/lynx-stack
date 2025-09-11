// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './edge-cases-rpx.css';

function App() {
  return (
    <view>
      {/* RPX in URL should not be transformed */}
      <view
        id='url-rpx'
        style="background-image: url('image-1rpx.png'); width: 100rpx;"
      >
        URL with RPX
      </view>

      {/* RPX in string literals should not be transformed */}
      <view
        id='string-rpx'
        style="content: 'text with 1rpx'; width: 100rpx;"
      >
        String with RPX
      </view>

      {/* Mixed with existing CSS transformations */}
      <view
        id='flex-rpx'
        style='display: flex; flex-basis: 100rpx; margin: 10rpx;'
      >
        Flex with RPX
      </view>

      {/* Color gradient with rpx */}
      <view
        id='gradient-rpx'
        style='color: linear-gradient(to right, red, blue); width: 100rpx; height: 50rpx;'
      >
        Gradient with RPX
      </view>

      {/* Linear weight with rpx */}
      <view
        id='linear-weight-rpx'
        style='display: linear; linear-weight: 1; width: 100rpx;'
      >
        Linear Weight with RPX
      </view>

      {/* Complex calc expressions */}
      <view
        id='calc-rpx'
        style='width: calc(100rpx + 20px); height: calc(50rpx * 2);'
      >
        Calc with RPX
      </view>

      {/* Multiple rpx values in one property */}
      <view
        id='multiple-rpx'
        style='box-shadow: 1rpx 2rpx 3rpx rgba(0,0,0,0.3), 4rpx 5rpx 6rpx rgba(255,0,0,0.2);'
      >
        Multiple RPX
      </view>

      {/* RPX with CSS custom properties */}
      <view
        id='custom-props-rpx'
        style='--my-width: 100rpx; width: var(--my-width); height: 50rpx;'
      >
        Custom Props RPX
      </view>

      {/* Large rpx values */}
      <view
        id='large-rpx'
        style='width: 9999rpx; height: 1000rpx;'
      >
        Large RPX
      </view>

      {/* Very small decimal rpx values */}
      <view
        id='small-decimal-rpx'
        style='width: 0.1rpx; height: 0.01rpx; margin: 0.001rpx;'
      >
        Small Decimal RPX
      </view>

      {/* RPX in transform functions */}
      <view
        id='transform-rpx'
        style='transform: translateX(50rpx) translateY(25rpx) rotate(45deg);'
      >
        Transform RPX
      </view>

      {/* RPX with different CSS properties */}
      <view
        id='various-props-rpx'
        style='border-width: 1rpx 2rpx 3rpx 4rpx; outline-width: 2rpx; column-gap: 10rpx;'
      >
        Various Props RPX
      </view>
    </view>
  );
}

root.render(
  <page>
    <App />
  </page>,
);
