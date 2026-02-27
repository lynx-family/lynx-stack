// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, Component } from '@lynx-js/react';
import './index.css';
export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      stateId: 0,
    };
  }
  handletap() {
    this.setState({ stateId: this.state.stateId + 1 });
  }
  getInline() {
    switch (this.state.stateId) {
      default:
        return { height: '100px', width: '100px' }; // green
    }
  }
  render() {
    return (
      <view id='parent' class='parent'>
        <view
          id='target'
          class='background-green background'
          style={this.getInline()}
        />
      </view>
    );
  }
}
