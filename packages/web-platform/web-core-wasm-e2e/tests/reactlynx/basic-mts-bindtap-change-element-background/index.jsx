// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view
      id='target'
      main-thread:bindTap={(event) => {
        'main thread';
        event.currentTarget.setStyleProperty('background-color', 'green');
      }}
      style={{
        height: '100px',
        width: '100px',
        background: 'pink',
      }}
    />
  );
}
root.render(<App />);
