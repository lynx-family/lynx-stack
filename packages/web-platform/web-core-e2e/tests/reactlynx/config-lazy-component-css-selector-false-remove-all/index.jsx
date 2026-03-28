/*
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';
import './index.css';
export default class Root extends Component {
  constructor(props) {
    super(props);
    this.state = {
      stateId: 0,
    };
  }
  handletap() {
    this.setState({ stateId: this.state.stateId + 1 });
  }
  getClass() {
    switch (this.state.stateId) {
      case 0:
        return 'background-yellow background-green';
      case 1:
        return '';
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
        style={{ height: '100px', width: '100px' }}
      />
    );
  }
}
