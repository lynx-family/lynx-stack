/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';

import './main.css';
let cnt = 0;
class App extends Component {
  state = { value: 'initial' };
  setTimeData(time) {
    lynx.createSelectorQuery()
      .select(`.container`)
      .setNativeProps({ text: time })
      .exec();
  }
  start() {
    if (cnt == 0) this.setTimeData('nativeText');
    if (cnt == 1) this.setState({ value: 'hello' });
    if (cnt == 2) this.setTimeData('2ndNative');
    if (cnt == 3) this.setState({ value: 'world' });
    cnt++;
  }
  render() {
    const { value } = this.state;
    return (
      <>
        <text class='container'>
          --{value}
          <text>text</text>
          {value}
        </text>
        <view
          style={{ width: '1px', height: '1px' }}
          id='target'
          bindtap={() => {
            this.start();
          }}
        >
        </view>
      </>
    );
  }
}
root.render(<App></App>);
