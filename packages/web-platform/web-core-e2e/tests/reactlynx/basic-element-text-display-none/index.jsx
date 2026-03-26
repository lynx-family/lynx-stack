// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view>
      <view>
        <text style='font-size: 20px;display:none;'>hello world</text>
        <text style='font-size: 30px;display:none;'>111</text>
      </view>
      <view>
        <text>
          <x-text style='font-size: 20px;display:none;'>
            hello world
          </x-text>
          <x-text style='font-size: 30px;display:none;'>111</x-text>
        </text>
      </view>
    </view>
  );
}
root.render(<App></App>);
