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
      <view id='container'>
        <view
          class='container-item'
          style={{ backgroundColor: 'red', order: 1 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'orange', order: 2 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'yellow', order: 2 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'green', order: 3 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'aqua', order: -1 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'blue', order: -2 }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'purple', order: 0 }}
        >
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
