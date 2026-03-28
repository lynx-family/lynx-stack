// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, root } from '@lynx-js/react';
class Foo extends Component {
  constructor(props) {
    super(props);
    // the following line made `this._nextState !== this.state` be truthy prior to the fix for preactjs/preact#2638
    this.state = { preact: '111' };
    this.setState({ preact: 'awesome' }, () => {
      this.setState({ preact: 'success' });
    });
  }
  render() {
    return (
      <view>
        <text>{this.state.preact}</text>
      </view>
    );
  }
}

root.render(<Foo></Foo>);
