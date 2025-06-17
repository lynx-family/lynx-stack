// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

function App() {
  return (
    <view>
      <text class='a b'>
        hello lynx
      </text>
    </view>
  );
}
root.render(<App></App>);
