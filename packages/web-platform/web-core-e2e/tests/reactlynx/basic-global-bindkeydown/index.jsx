// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function App() {
  const [color, setColor] = useState('pink');
  return (
    <view>
      <view
        id='observer'
        global-bindKeydown={() => setColor(color === 'pink' ? 'green' : 'pink')}
        style={{ height: '100px', width: '100px', background: color }}
      />
    </view>
  );
}

root.render(<App />);
