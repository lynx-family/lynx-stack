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
      flag: false,
    };
  }
  handletap() {
    this.setState({ flag: !this.state.flag });
  }
  render() {
    return (
      <view
        id='target'
        class={'background-yellow '
          + (this.state.flag ? 'background-green' : '')}
        bindtap={() => {
          this.handletap();
        }}
        style={{
          height: '100px',
          width: '100px',
          backgroundColor: this.state.flag ? 'yellow' : 'green',
        }}
      />
    );
  }
}
