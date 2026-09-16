// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
import './index.css';

function App() {
  const [updated, setUpdated] = useState(false);
  return (
    <view>
      <view
        id='solid-parent'
        class={updated ? 'typography updated' : 'typography'}
      >
        <text id='solid-text'>Inherited text</text>
        <wrapper>
          <text id='wrapped-text'>Wrapped text</text>
        </wrapper>
        <text id='nested-parent'>
          <text id='nested-text'>Nested text</text>
        </text>
      </view>
      <view class='gradient'>
        <text id='gradient-text'>Gradient text</text>
        <wrapper>
          <text id='wrapped-gradient'>Wrapped gradient</text>
        </wrapper>
        <text id='override-text' class='override'>Explicit solid color</text>
      </view>
      <view class='typography'>
        <text id='own-gradient' class='gradient'>Explicit gradient color</text>
      </view>
      <view id='update' bindtap={() => setUpdated(true)}>
        <text>Update</text>
      </view>
    </view>
  );
}

root.render(<App />);
