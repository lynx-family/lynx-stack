// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view style='display:flex;flex-direction:column;'>
      <text text-maxlength='1'>
        The layout of the text component is different from that of the view
        component. It does not support setting display and related properties
        for layout, and has its own text layout method internally. Currently,
        native layout and rendering are used.
      </text>
      <text text-maxlength='1'>简体中文</text>
      <text text-maxlength='2'>
        The layout of the text component is different from that of the view
        component. It does not support setting display and related properties
        for layout, and has its own text layout method internally. Currently,
        native layout and rendering are used.
      </text>
      <text text-maxlength='2'>简体中文</text>
      <text text-maxlength='3'>
        简<text style='color:red;'>体</text>中文
      </text>
      <text text-maxlength='3'>
        简<text style='color:red;'>体中</text>文
      </text>
      <text text-maxlength='3'>
        简<text style='color:red;'>体中文</text>
      </text>
      <text text-maxlength='200'>
        The layout of the text component is different from that of the view
        component. It does not support setting display and related properties
        for layout, and has its own text layout method internally. Currently,
        native layout and rendering are used.
      </text>
      <text>
        The layout of the text component is different from that of the view
        component. It does not support setting display and related properties
        for layout, and has its own text layout method internally. Currently,
        native layout and rendering are used.
      </text>
    </view>
  );
}
root.render(<App></App>);
