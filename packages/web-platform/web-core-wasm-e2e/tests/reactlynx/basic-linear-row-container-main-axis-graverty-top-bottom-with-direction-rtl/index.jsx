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
      <view style='display:flex; flex-direction:column;'>
        <view
          id='container-top'
          class='container top horizontal'
          style='background-color:pink;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-bottom'
          class='container bottom horizontal'
          style='background-color:#99ddaa;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-top-rtl'
          class='container top horizontal rtl'
          style='background-color:pink;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-bottom-rtl'
          class='container bottom horizontal rtl'
          style='background-color:#99ddaa;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-top-reverse'
          class='container top horizontal-reverse'
          style='background-color:pink;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-bottom-reverse'
          class='container bottom horizontal-reverse'
          style='background-color:#99ddaa;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-top-rtl-reverse'
          class='container top horizontal-reverse rtl'
          style='background-color:pink;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-bottom-rtl-reverse'
          class='container bottom horizontal-reverse rtl'
          style='background-color:#99ddaa;width:300px;height:50px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
