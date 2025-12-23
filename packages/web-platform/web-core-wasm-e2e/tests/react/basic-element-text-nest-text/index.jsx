// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view>
      <text
        style='font-size: 24px; font-weight: bold;'
        text-maxline='1'
        ellipsize-mode='tail'
      >
        I am bold
        <x-text style='font-size: 24px; color: red;'>
          and red
        </x-text>
        longlonglonglonglonglonglonglonglong text
        longlonglonglonglonglonglonglonglong
      </text>
    </view>
  );
}
root.render(<App></App>);
