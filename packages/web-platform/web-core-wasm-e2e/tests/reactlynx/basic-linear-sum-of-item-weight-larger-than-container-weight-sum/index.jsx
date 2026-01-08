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
      <view
        id='container'
        class='container container-weight-sum-2'
        style='background-color:pink;width:200px;'
      >
        <view
          id='weight0'
          class='container-item'
          style='width:140px;height:100px;background-color:red;'
        />
        <view
          id='weight1'
          class='container-item linear-item-weight-1'
          style='width:100px;height:100px;background-color:yellow;'
        />
        <view
          id='weight2'
          class='container-item linear-item-weight-2'
          style='width:100px;height:100px;background-color:green;'
        />
      </view>
    );
  }
}
root.render(<Page></Page>);
