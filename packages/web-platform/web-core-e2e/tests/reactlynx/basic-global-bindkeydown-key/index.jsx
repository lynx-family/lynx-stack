// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function App() {
  const [lastKey, setLastKey] = useState('none');
  return (
    <view>
      <view
        id='observer'
        global-bindKeydown={(e) => setLastKey(e.key)}
        data-key={lastKey}
        style={{ height: '100px', width: '100px', background: 'pink' }}
      >
        <text>{lastKey}</text>
      </view>
    </view>
  );
}

root.render(<App />);
