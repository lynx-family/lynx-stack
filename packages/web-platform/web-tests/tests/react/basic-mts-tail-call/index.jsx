// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
function App() {
  const [color] = useState('pink');
  const mtsFoo = (count) => {
    'main thread';
    if (count > 0) {
      console.log('hello world');
    } else {
      mtsFoo(count + 1);
    }
  };
  return (
    <view
      id='target'
      main-thread:bindTap={mtsFoo}
      style={{
        height: '100px',
        width: '100px',
        background: color,
      }}
    />
  );
}
root.render(<App />);
