// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view style='display:flex;flex-direction:column;'>
      <text tail-color-convert text-maxlength='3'>
        简<text style='color:red;'>体中文</text>
      </text>
      <text tail-color-convert text-maxlength='10'>
        简<text style='color:red;'>体中文</text>
      </text>
      <text style='color: blue;' tail-color-convert text-maxlength='3'>
        简<text style='color:red;'>体中文</text>
      </text>
    </view>
  );
}
root.render(<App></App>);
