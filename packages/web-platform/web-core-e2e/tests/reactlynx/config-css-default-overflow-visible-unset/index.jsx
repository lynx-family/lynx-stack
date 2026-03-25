// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view style='display:flex; justify-content: space-around; height: 300px '>
      <view class='outer-box' style='overflow-x:visible; overflow-y:hidden;'>
        <view class='inner-box'>
          <text>1</text>
        </view>
      </view>

      <view class='outer-box' style='overflow:hidden'>
        <view class='inner-box'>
          <text>2</text>
        </view>
      </view>

      <view class='outer-box' style='overflow-x:hidden; overflow-y:visible;'>
        <view class='inner-box'>
          <text>3</text>
        </view>
      </view>

      <view class='outer-box' style='overflow:hidden'>
        <view class='inner-box'>
          <text>4</text>
        </view>
      </view>

      <view class='outer-box' style='overflow:visible'>
        <view class='inner-box'>
          <text>5</text>
        </view>
      </view>

      <view class='outer-box'>
        <view class='inner-box'>
          <text>6</text>
        </view>
      </view>
    </view>
  );
}
root.render(<App />);
