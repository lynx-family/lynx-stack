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
        <view style='display:flex; flex-direction:column;'>
          <view
            id='container-start'
            class='container start row'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end'
            class='container end row'
            style='background-color:#99ddaa;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl'
            class='container start row rtl'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl'
            class='container end row rtl'
            style='background-color:#99ddaa;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
        </view>
        <view style='display:flex; flex-direction:column;'>
          <view
            id='container-start-reverse'
            class='container start row-reverse'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-reverse'
            class='container end row-reverse'
            style='background-color:#99ddaa;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl-reverse'
            class='container start row-reverse rtl'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl-reverse'
            class='container end row-reverse rtl'
            style='background-color:#99ddaa;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-reverse'
            class='container flex-start row-reverse'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-reverse'
            class='container flex-end row-reverse'
            style='background-color:#99ddaa;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-start-rtl-reverse'
            class='container flex-start row-reverse rtl'
            style='background-color:pink;width:300px;'
          >
            <view class='container-item' style='background-color:red;' />
            <view class='container-item' style='background-color:green;' />
            <view class='container-item' style='background-color:blue;' />
          </view>
          <view
            id='container-end-rtl-reverse'
            class='container flex-end row-reverse rtl'
            style='background-color:#99ddaa;width:300px;'
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
