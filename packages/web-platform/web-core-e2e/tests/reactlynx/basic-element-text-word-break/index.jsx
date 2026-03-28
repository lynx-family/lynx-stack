/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';

export default class App extends Component {
  render() {
    return (
      <view>
        <text style='width:100px;'>12345678901234567890</text>
        <text style='width:100px;'>12345 67890 12345 67890</text>
        <text style='width:100px;'>你好世界你好世界你好世界你好世界</text>
        <text style='width:100px;'>abcdefghijklmnopqrstu</text>
        <text style='width:100px;'>abcde fghij klmno pqrstu</text>
        <text style='width:100px;'>你好世界 你好世界 你好世界 你好世界</text>
      </view>
    );
  }
}
root.render(<App />);
