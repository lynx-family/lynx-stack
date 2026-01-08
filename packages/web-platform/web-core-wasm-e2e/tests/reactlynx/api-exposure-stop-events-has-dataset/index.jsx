/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';

class Page extends Component {
  constructor(props) {
    super(props);
    if (!__LEPUS__) {
      lynx.getJSModule('GlobalEventEmitter').addListener(
        'disexposure',
        this.disexposure,
        this,
      );
    }
  }

  componentWillUnmount() {
    lynx.getJSModule('GlobalEventEmitter').removeListener(
      'disexposure',
      this.disexposure,
    );
  }

  disexposure(e) {
    if (e[0].target.dataset.trackstat === 'data') {
      console.log('pass:dataset1');
    }
    if (e[0].dataset.trackstat === 'data') {
      console.log('pass:dataset2');
    }
  }

  tap1 = (e) => {
    this.setState({ log: 'none' });
    lynx.stopExposure();
    lynx.resumeExposure();
  };

  render() {
    return (
      <view class='container' exposure-id='show' data-trackstat='data'>
        <view
          id='button'
          bindtap={this.tap1}
          style={{ height: '10px', width: '10px' }}
        >
        </view>
      </view>
    );
  }
}

root.render(<Page />);
