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
      <view style='display:flex; width:100px;overflow:visible;'>
        <view style='background-color: #ddeedd; width: 300px; height: 400px; '>
          <view>
            <view style='width:200px; height: 300px; background-color: #ddddee;' />
          </view>
          <view style='overflow:visible'>
            <view style='width:250px; height: 300px; background-color: #eedddd;' />
          </view>
        </view>
        <view style='background-color: #ccddcc; width: 300px; height: 400px; flex-direction: column '>
          <view>
            <view style='width:200px; height: 200px; background-color: #ddddee;' />
          </view>
          <view style='overflow:visible'>
            <view style='width:200px; height: 400px; background-color: #eedddd;' />
          </view>
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
