// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './css-style-rpx.css';

function App() {
  return (
    <view>
      {/* Basic rpx in CSS classes */}
      <view className='basic-rpx-class' id='basic-css-rpx'>
        Basic CSS RPX
      </view>

      {/* Mixed units in CSS */}
      <view className='mixed-units-class' id='mixed-css-units'>
        Mixed CSS Units
      </view>

      {/* Responsive rpx values */}
      <view className='responsive-rpx' id='responsive-css-rpx'>
        Responsive CSS RPX
      </view>

      {/* Animation with rpx */}
      <view className='animated-rpx' id='animated-css-rpx'>
        Animated CSS RPX
      </view>

      {/* Pseudo elements with rpx */}
      <view className='pseudo-rpx' id='pseudo-css-rpx'>
        Pseudo CSS RPX
      </view>

      {/* Complex selectors with rpx */}
      <view className='container'>
        <view className='child-rpx' id='child-css-rpx'>
          Child CSS RPX
        </view>
      </view>

      {/* Media queries with rpx */}
      <view className='media-rpx' id='media-css-rpx'>
        Media Query CSS RPX
      </view>

      {/* CSS variables with rpx */}
      <view className='var-rpx' id='var-css-rpx'>
        CSS Variables RPX
      </view>
    </view>
  );
}

root.render(
  <page>
    <App />
  </page>,
);
