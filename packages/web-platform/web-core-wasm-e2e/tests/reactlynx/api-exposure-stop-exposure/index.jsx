/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';
import './index.css';

class Page extends Component {
  state = {
    log: 'none',
  };

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
    this.setState({ log: 'disexposure' });
  }

  tap1 = (e) => {
    this.setState({ log: 'none' });
    lynx.stopExposure();
    lynx.resumeExposure();
  };

  tap2 = (e) => {
    this.setState({ log: 'none' });
    lynx.stopExposure({ sendEvent: true });
    lynx.resumeExposure();
  };

  tap3 = (e) => {
    this.setState({ log: 'none' });
    lynx.stopExposure({ sendEvent: false });
    lynx.resumeExposure();
  };

  render() {
    return (
      <view class='container'>
        ˇ
        <view class='log'>
          <view class='show' exposure-id='show'>
            <text style='font-size: 18px;'>{this.state.log}</text>
          </view>
        </view>
        <view class='menu'>
          <view class='button' bindtap={this.tap1}>
            <text>lynx.stopExposure()</text>
          </view>
          <view class='button' bindtap={this.tap2}>
            <text>
              lynx.stopExposure({'{'}sendEvent: true{'}'})
            </text>
          </view>
          <view class='button' bindtap={this.tap3}>
            <text>
              lynx.stopExposure({'{'}sendEvent: false{'}'})
            </text>
          </view>
        </view>
      </view>
    );
  }
}

root.render(<Page />);
