/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, root } from '@lynx-js/react';

export default class ScrollBounce extends Component {
  state = {
    success: false,
  };
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <scroll-view
        id='bounce-view'
        style={`width:300px; height:600px; background-color:yellow;`}
        scroll-y={true}
        initial-scroll-to-index={1}
      >
        <view style='width:100%;height:300px;background:red;'></view>
        <view style='width:100%;height:300px;background:green;'></view>
        <view style='width:100%;height:300px;background:blue;'></view>
      </scroll-view>
    );
  }
}
root.render(<ScrollBounce />);
