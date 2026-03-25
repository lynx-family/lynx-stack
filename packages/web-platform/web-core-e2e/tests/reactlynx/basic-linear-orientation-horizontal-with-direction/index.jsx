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
      <view style='display:flex; flex-direction: column'>
        <view id='container'>
          <view
            class='container-item'
            style={{ backgroundColor: 'red' }}
          >
          </view>
          <view
            class='container-item'
            style={{ backgroundColor: 'orange' }}
          >
          </view>
          <view
            class='container-item'
            style={{ backgroundColor: 'yellow' }}
          >
          </view>
        </view>
        <view id='container' class='rtl'>
          <view
            class='container-item'
            style={{ backgroundColor: 'red' }}
          >
          </view>
          <view
            class='container-item'
            style={{ backgroundColor: 'orange' }}
          >
          </view>
          <view
            class='container-item'
            style={{ backgroundColor: 'yellow' }}
          >
          </view>
        </view>
      </view>
    );
  }
}
root.render(<Page></Page>);
