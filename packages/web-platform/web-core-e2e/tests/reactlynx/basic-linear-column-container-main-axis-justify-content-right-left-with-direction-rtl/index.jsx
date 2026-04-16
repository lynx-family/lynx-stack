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
      <view style='display:flex; flex-direction:row;'>
        <view
          id='container-left'
          class='container left vertical'
          style='background-color:pink;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right'
          class='container right vertical'
          style='background-color:#99ddaa;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-rtl'
          class='container left vertical rtl'
          style='background-color:pink;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-rtl'
          class='container right vertical rtl'
          style='background-color:#99ddaa;width:50px;height:300px;direction:lynx-rtl;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-reverse'
          class='container left vertical-reverse'
          style='background-color:pink;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-reverse'
          class='container right vertical-reverse'
          style='background-color:#99ddaa;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-rtl-reverse'
          class='container left vertical-reverse rtl'
          style='background-color:pink;width:50px;height:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-rtl-reverse'
          class='container right vertical-reverse rtl'
          style='background-color:#99ddaa;width:50px;height:300px;'
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
