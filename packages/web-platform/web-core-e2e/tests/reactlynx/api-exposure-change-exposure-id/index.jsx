/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';

import './main.css';

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
    const { index, exposure, disexposure } = this.state;
    return (
      <view
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <scroll-view scroll-x>
          <view
            style={{
              border: '1px black solid',
              margin: '10px',
              width: '100px',
              height: '50px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bindtap={() => {
              this.setState({
                index: 1,
              });
            }}
          >
            <text>1</text>
          </view>
          <view
            style={{
              border: '1px black solid',
              margin: '10px',
              width: '100px',
              height: '50px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bindtap={() => {
              this.setState({
                index: 2,
              });
            }}
          >
            <text>2</text>
          </view>
          <view
            style={{
              border: '1px black solid',
              margin: '10px',
              width: '100px',
              height: '50px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bindtap={() => {
              this.setState({
                index: 3,
              });
            }}
          >
            <text>3</text>
          </view>
          <view
            style={{
              border: '1px black solid',
              margin: '10px',
              width: '100px',
              height: '50px',
              display: 'flex',
              flexDirection: 'column',
            }}
            bindtap={() => {
              this.setState({
                index: 4,
              });
            }}
          >
            <text>4</text>
          </view>
        </scroll-view>

        <view
          style={{ flexDirection: 'column' }}
          className='container'
          exposure-id={index + ''}
        >
          <text>current: {index}</text>
          <text>target index: {exposure}</text>
          <text>prev index: {disexposure}</text>
        </view>
      </view>
    );
  }
}

root.render(<App />);
