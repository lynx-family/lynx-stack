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
      <>
        <view style='display:flex; flex-direction:row;'>
          <view
            id='container-start'
            class='container start vertical'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end'
            class='container end vertical'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl'
            class='container start vertical rtl'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl'
            class='container end vertical rtl'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
        </view>
        <view style='display:flex; flex-direction:row;'>
          <view
            id='container-start-reverse'
            class='container start vertical-reverse'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-reverse'
            class='container end vertical-reverse'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl-reverse'
            class='container start vertical-reverse rtl'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl-reverse'
            class='container end vertical-reverse rtl'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-reverse'
            class='container flex-start vertical-reverse'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-reverse'
            class='container flex-end vertical-reverse'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl-reverse'
            class='container flex-start vertical-reverse rtl'
            style='background-color:pink;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl-reverse'
            class='container flex-end vertical-reverse rtl'
            style='background-color:#99ddaa;height:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
        </view>
      </>
    );
  }
}
root.render(<Page></Page>);
