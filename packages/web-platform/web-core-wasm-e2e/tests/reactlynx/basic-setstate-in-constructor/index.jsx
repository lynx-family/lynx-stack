// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';
class Foo extends Component {
  constructor(props) {
    super(props);
    // the following line made `this._nextState !== this.state` be truthy prior to the fix for preactjs/preact#2638
    this.state = { color: 'pink' };
    this.setState({ color: 'green' });
  }
  render() {
    return (
      <view
        id='target'
        style={{
          height: '100px',
          width: '100px',
          backgroundColor: this.state.color,
        }}
      >
      </view>
    );
  }
}
root.render(<Foo></Foo>);
