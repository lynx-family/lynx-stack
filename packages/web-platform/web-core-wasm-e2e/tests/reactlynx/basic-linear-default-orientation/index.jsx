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
      <view class='container'>
        <view class='container-item' style='background-color:red;' />
        <view class='container-item' style='background-color:green;' />
        <view class='container-item' style='background-color:blue;' />
      </view>
    );
  }
}
root.render(<Page></Page>);
