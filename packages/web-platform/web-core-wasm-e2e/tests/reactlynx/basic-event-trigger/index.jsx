// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
function App() {
  const [text, setText] = useState('');

  const handleCaptureTap = () => {
    setText(text + '[capture tap]');
  };
  const handleTap = () => {
    setText(text + '[bind tap]');
  };

  return (
    <view
      id='target1'
      style={{ width: '400px', height: '400px', background: 'pink' }}
      capture-bindtap={handleCaptureTap}
      bindtap={handleTap}
    >
      <view
        style={{ width: '50px', height: '50px', background: 'green' }}
        id='target2'
      >
      </view>
      <text id='target'>{text}</text>
    </view>
  );
}
root.render(
  <page>
    <App></App>
  </page>,
);
