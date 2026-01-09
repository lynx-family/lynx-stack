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
          id='container-left'
          class='container left row'
          style='background-color:pink;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right'
          class='container right row'
          style='background-color:#99ddaa;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-rtl'
          class='container left row rtl'
          style='background-color:pink;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-rtl'
          class='container right row rtl'
          style='background-color:#99ddaa;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-reverse'
          class='container left row-reverse'
          style='background-color:pink;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-reverse'
          class='container right row-reverse'
          style='background-color:#99ddaa;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-left-rtl-reverse'
          class='container left row-reverse rtl'
          style='background-color:pink;width:50px;width:300px;'
        >
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>
        <view
          id='container-right-rtl-reverse'
          class='container right row-reverse rtl'
          style='background-color:#99ddaa;width:50px;width:300px;'
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
