// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      index: 1,
      exposure: '',
      disexposure: '',
    };
  }

  componentDidMount() {
    lynx.getJSModule('GlobalEventEmitter').addListener(
      'exposure',
      this.exposure,
      this,
    );
    lynx.getJSModule('GlobalEventEmitter').addListener(
      'disexposure',
      this.disexposure,
      this,
    );
  }

  componentWillUnmount() {
    lynx.getJSModule('GlobalEventEmitter').removeListener(
      'exposure',
      this.exposure,
    );
    lynx.getJSModule('GlobalEventEmitter').removeListener(
      'disexposure',
      this.disexposure,
    );
  }

  exposure(e) {
    console.log(e);
    this.setState({
      exposure: e[0].exposureID,
    });
  }

  disexposure(e) {
    console.log(e);
    this.setState({
      disexposure: e[0].exposureID,
    });
  }

  render() {
    return (
      <view
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <scroll-view scroll-y style='height:500px; width:300px;' id='x'>
          <view
            style={{
              height: '100%',
              width: '100%',
              backgroundColor: 'red',
            }}
          />
          <view
            exposure-id='expo'
            exposure-area='50%'
            style={{
              height: '100%',
              width: '100%',
              backgroundColor: this.state.exposure === 'expo'
                ? 'green'
                : 'yellow',
            }}
          />
        </scroll-view>
      </view>
    );
  }
}

root.render(<App />);
