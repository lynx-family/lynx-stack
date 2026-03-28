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
          style={{ backgroundColor: 'yellow' }}
        >
        </view>
        <view
          class='container-item'
          style={{ backgroundColor: 'green' }}
        >
        </view>
        <view class='container-item' style={{ backgroundColor: 'blue' }}></view>
      </view>
    );
  }
}
root.render(<Page></Page>);
