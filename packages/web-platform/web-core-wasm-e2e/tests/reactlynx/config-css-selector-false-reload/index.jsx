// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, Component } from '@lynx-js/react';
import './index.css';
export default class App extends Component {
  render() {
    return (
      <view id='target' class='parent'>
      </view>
    );
  }
}

root.render(<App></App>);
