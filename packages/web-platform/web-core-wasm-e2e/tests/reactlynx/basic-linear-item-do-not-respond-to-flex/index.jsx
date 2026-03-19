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
      <view id='container' style='width:110px;overflow:visible;'>
        <view
          class='container-item'
          style='width:100px;display:flex;overflow:visible;'
        >
          <view style='background-color:pink; width:10px; height:100px;' />
        </view>
        <view
          class='container-item'
          style='width:100px;display:flex;overflow:visible;'
        >
          <view style='background-color:aqua; width:100px; height:100px;' />
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
