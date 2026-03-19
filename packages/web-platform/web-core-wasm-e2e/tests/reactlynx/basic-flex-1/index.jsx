/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';
import './index.css';
class Page extends Component {
  render() {
    return (
      <view style=' flex-direction: column;'>
        <view style='flex:1;'>
          <view style='width:50px;height:50px;background:green;'></view>
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
