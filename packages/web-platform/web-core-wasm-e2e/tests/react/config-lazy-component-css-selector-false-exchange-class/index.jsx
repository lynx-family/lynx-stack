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
  getClass() {
    switch (this.state.stateId) {
      case 0:
        return 'background-yellow background-green';
      case 1:
        return 'background-green background-yellow ';
    }
  }
  render() {
    return (
      <view
        id='target'
        class={this.getClass()}
        bindtap={() => {
          this.handletap();
        }}
        style={this.getInline()}
      />
    );
  }
}
