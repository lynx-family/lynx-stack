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
      <view style='display:flex;flex-direction:column;'>
        <view class='container start vertical'>
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>

        <view class='container end vertical'>
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>

        <view class='container center vertical'>
          <view class='container-item' style='background-color:red;' />
          <view class='container-item' style='background-color:green;' />
          <view class='container-item' style='background-color:blue;' />
        </view>

        <view class='container stretch vertical'>
          <view
            class='container-item'
            style='background-color:red; width:auto'
          />
          <view
            class='container-item'
            style='background-color:green; width:auto'
          />
          <view
            class='container-item'
            style='background-color:blue; width:auto'
          />
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
