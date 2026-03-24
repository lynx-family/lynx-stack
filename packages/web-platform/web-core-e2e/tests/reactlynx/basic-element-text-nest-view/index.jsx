// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view>
      <text style='font-size: 40px;'>
        hello world
        <view style='padding: 10px; border: 1px solid red;border-radius: 20px;'>
          <text style='font-size: 30px; color: linear-gradient(green, yellow);'>
            sub text
          </text>
        </view>
        other text content
      </text>
    </view>
  );
}
root.render(<App></App>);
