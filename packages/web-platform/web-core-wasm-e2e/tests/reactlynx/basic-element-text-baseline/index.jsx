// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view style='display:flex;'>
      <view style='display:flex;'>
        <text style='font-size: 20px;'>hello world</text>
        <text style='font-size: 30px'>111</text>
      </view>
      <view style='display:flex;'>
        <text>
          <x-text style='font-size: 20px;'>hello world</x-text>
          <x-text style='font-size: 30px'>111</x-text>
        </text>
      </view>
    </view>
  );
}
root.render(<App></App>);
