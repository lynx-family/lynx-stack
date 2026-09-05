// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root, useState } from '@lynx-js/preact-runtime';

function Item() {
  const [counter] = useState(0);
  return counter === 1 ? <text>{counter}</text> : null;
}

function App() {
  return (
    <view>
      {Array.from({ length: 1000 }).map((_, i) => <Item key={i} />)}
      <view id='stop-benchmark-true' />
    </view>
  );
}

root.render(<App />);
