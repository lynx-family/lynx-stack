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
      <view style='display:flex;flex-direction:row;'>
        <view class='container vertical pink items-center'>
          <view
            class='container-item self-right'
            style='background-color:red;'
          />
          <view
            class='container-item self-left'
            style='background-color:green;'
          />
          <view
            class='container-item self-top'
            style='background-color:blue;'
          />
          <view
            class='container-item self-bottom'
            style='background-color:yellow;'
          />
          <view
            class='container-item self-start'
            style='background-color:black;'
          />
          <view
            class='container-item self-end'
            style='background-color:purple;'
          />
        </view>
        <view class='container vertical pink'>
          <view
            class='container-item self-center'
            style='background-color:red;'
          />
          <view
            class='container-item self-center-horizontal'
            style='background-color:green;'
          />
          <view
            class='container-item self-center-vertical'
            style='background-color:blue;'
          />
          <view
            class='container-item self-stretch'
            style='background-color:yellow; width:auto;'
          />
          <view
            class='container-item self-fill-vertical'
            style='background-color:black;'
          />
          <view
            class='container-item self-fill-horizontal'
            style='background-color:purple; width:auto;'
          />
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
