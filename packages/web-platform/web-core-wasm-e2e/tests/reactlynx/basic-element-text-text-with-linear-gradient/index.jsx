// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view>
      <text style='font-size: 80px; color: linear-gradient(green, yellow);'>
        sub text
      </text>
    </view>
  );
}
root.render(<App></App>);
