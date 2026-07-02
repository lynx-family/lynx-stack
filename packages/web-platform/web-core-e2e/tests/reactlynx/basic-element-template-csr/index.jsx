// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
import './index.css';

function App() {
  const [active, setActive] = useState(false);

  return (
    <view
      id='target'
      className={active ? 'active' : 'idle'}
      data-state={active ? 'active' : 'idle'}
      bindtap={() => setActive(value => !value)}
    >
      <text id='label'>{active ? 'enabled' : 'idle'}</text>
      {active
        ? <text id='slot-child'>slot-on</text>
        : <text id='slot-child'>slot-off</text>}
    </view>
  );
}

root.render(<App />);
