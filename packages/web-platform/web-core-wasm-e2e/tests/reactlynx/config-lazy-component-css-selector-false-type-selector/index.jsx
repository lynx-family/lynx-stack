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
  render() {
    return <view id='target' class='tt' />;
  }
}
