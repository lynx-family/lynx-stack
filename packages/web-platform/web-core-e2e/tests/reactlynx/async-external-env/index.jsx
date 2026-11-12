// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import { platform } from './read-env.js';

function App() {
  const [count, setCount] = useState(0);
  return (
    <view>
      <text>Platform: {platform}</text>
      <text id='counter' bindtap={() => setCount(count + 1)}>
        Count: {count}
      </text>
    </view>
  );
}

root.render(<App />);
