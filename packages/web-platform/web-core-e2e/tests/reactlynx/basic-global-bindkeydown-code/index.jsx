// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function App() {
  const [lastCode, setLastCode] = useState('none');
  return (
    <view>
      <view
        id='observer'
        global-bindKeydown={(e) => setLastCode(e.code)}
        data-code={lastCode}
        style={{ height: '100px', width: '100px', background: 'pink' }}
      >
        <text>{lastCode}</text>
      </view>
    </view>
  );
}

root.render(<App />);
