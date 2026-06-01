// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

// Verifies that a non-global `bindKeydown` handler does NOT fire for a key
// pressed outside the Lynx view (Rust dispatcher early-returns when the
// bubble path is empty, so only `global-bind*` handlers see such events).
function App() {
  const [color, setColor] = useState('pink');
  return (
    <view>
      <view
        id='observer'
        bindKeydown={() => setColor('green')}
        style={{ height: '100px', width: '100px', background: color }}
      />
    </view>
  );
}

root.render(<App />);
