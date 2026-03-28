// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
function App() {
  const [color, setColor] = useState('pink');
  const handleTap = () => {
    setColor('green');
  };

  return (
    <page
      bindtap={handleTap}
    >
      <view
        id='target'
        style={{ width: '100px', height: '100px', backgroundColor: color }}
      >
      </view>
    </page>
  );
}
root.render(
  <App></App>,
);
