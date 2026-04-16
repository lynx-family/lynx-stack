// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';
import './placeholder.css';
class Page extends Component {
  state = {
    color: 'white',
  };
  componentDidMount() {
    this.GlobalEventEmitter.addListener(
      'exposure',
      this.onExposure,
      this,
    );
    this.GlobalEventEmitter.addListener(
      'disexposure',
      this.onDisexposure,
      this,
    );
  }

  componentWillUnmount() {
    this.GlobalEventEmitter.removeListener('exposure', this.onExposure);
    this.GlobalEventEmitter.removeListener('disexposure', this.onDisexposure);
  }

  onExposure(event) {
    event.forEach((item) => {
      if (item['exposure-id'] == 'header') {
        this.setState({ color: 'red' });
      } else if (item['exposure-id'] == 'lay') {
        this.setState({ color: 'yellow' });
      }
    });
  }

  onDisexposure(event) {
    this.setState({ color: 'white' });
  }

  render() {
    const { color } = this.state;
    return (
      <view style={{ height: '500px', display: 'flex' }}>
        <scroll-view id='y' scroll-y style={{ width: '100%' }}>
          <text>Hello World!!</text>
          <text style={{ height: '50%', background: this.state.color }} />
          <scroll-view id='x' scroll-x style={{ height: '50%', width: '100%' }}>
            <text style={{ width: '400px', background: 'white' }}>
              vertical or horizontal swipe
            </text>
            <text
              style={{ width: '100%', background: 'orange' }}
              exposure-id='lay'
            >
              456
            </text>
          </scroll-view>
          <text
            exposure-scene='see_music'
            exposure-id='header'
            style={{
              marginTop: '10px',
              height: '250px',
              width: '100%',
              background: 'red',
            }}
          >
            exposure detecting area
          </text>
        </scroll-view>
      </view>
    );
  }
}
root.render(<Page />);
