/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';
import './placeholder.css';

class LazyComponent extends Component {
  constructor(props) {
    super(props);
    if (!__LEPUS__) {
      lynx.getJSModule('GlobalEventEmitter').addListener(
        'exposure',
        this.exposure,
        this,
      );
    }
  }
  state = {};

  componentWillUnmount() {
    lynx.getJSModule('GlobalEventEmitter').removeListener(
      'exposure',
      this.exposure,
    );
  }

  exposure(e) {
    console.log('exposure');
    e.forEach((item) => {
      if (this.props.eid == '789') {
        if (item['exposure-id'] == '789') {
          this.setState({ show: true, color: 'green' });
        }
      } else if (this.props.eid != '789') {
        this.setState({ show: true, color: 'red' });
        this.props.myevent();
      }
    });
  }

  render() {
    let { show } = this.state;
    return (
      <view
        style='width: 400px;height: 400px'
        exposure-id={this.props.eid}
        exposure-scene={this.props.escene}
        exposure-ui-margin-top={this.props.border}
      >
        {show && (
          <text
            style={{
              width: '400px',
              height: '400px',
              background: this.state.color,
            }}
          />
        )}
      </view>
    );
  }
}

class Page extends Component {
  onTriggered = () => {
    this.setState({ show_awa: true });
  };

  render() {
    let { show_awa } = this.state;
    return (
      <view>
        <scroll-view id='y' scroll-y style={{ height: '100vh' }}>
          <text>Hello World!</text>
          <text
            style={{ width: '400px', height: '400px', background: 'red' }}
          />
          {!show_awa
            ? (
              <text style='height:400px; width:400px'>
                will be orange if it works
              </text>
            )
            : (
              <text
                style={{
                  width: '400px',
                  height: '400px',
                  background: 'orange',
                }}
              />
            )}
          <text
            style={{ width: '400px', height: '400px', background: 'yellow' }}
          />
          <view
            style={{
              height: '1px',
              borderTop: 'solid #ACC068 1px',
              marginTop: '-200px',
            }}
          />
          <LazyComponent
            id='dame'
            style={{ marginTop: '200px' }}
            border='50%'
            eid='123'
            escene='456'
            myevent={this.onTriggered}
          />
          <LazyComponent border='-50%' eid='789' escene='012' />
          <view
            style={{
              height: '1px',
              borderTop: 'solid #ACC068 1px',
              marginTop: '-200px',
            }}
          />
        </scroll-view>
      </view>
    );
  }
}
root.render(<Page />);
