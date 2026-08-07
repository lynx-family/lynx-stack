// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect } from '@lynx-js/react';

import { bump } from './counter.js' with { runtime: 'shared' };

function App() {
  useEffect(() => {
    // Three bumps on the background's own instance.
    bump();
    bump();
    bump();
  }, []);

  return (
    <view
      id='target'
      main-thread:bindTap={(event) => {
        'main thread';
        // The main thread's own instance starts at 0, so this reads 1 —
        // not 4 — if the two threads really hold independent instances.
        event.currentTarget.setAttribute('data-count', String(bump()));
      }}
      style={{ height: '100px', width: '100px', background: 'pink' }}
    />
  );
}
root.render(<App />);
