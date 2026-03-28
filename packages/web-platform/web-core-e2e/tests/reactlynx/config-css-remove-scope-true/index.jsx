// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
import { Sub } from './sub.jsx';
function App() {
  return (
    <view id='index' class='basic'>
      <Sub></Sub>
    </view>
  );
}
root.render(<App></App>);
