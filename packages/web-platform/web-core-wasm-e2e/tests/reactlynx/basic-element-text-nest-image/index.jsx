// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import Image from './images/5a076f79f05c644487d688bba0817195.png';
import { root } from '@lynx-js/react';
function App() {
  return (
    <view>
      <text style='font-size: 24px; color: blue'>
        图文混排
        <image
          src={Image}
          style='width: 22px; height: 22px; margin-left: 10px;'
        />
      </text>
    </view>
  );
}
root.render(<App></App>);
