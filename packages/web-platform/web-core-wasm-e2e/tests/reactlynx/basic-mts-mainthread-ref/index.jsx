// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useMainThreadRef } from '@lynx-js/react';

export function App() {
  const ref = useMainThreadRef(null);

  const handleTap = () => {
    'main thread';
    ref.current.setStyleProperties({
      'background-color': 'green',
      'height': '200px',
      'width': '200px',
    });
  };

  return (
    <view
      id='target'
      main-thread:ref={ref}
      main-thread:bindtap={handleTap}
      style={{
        height: '100px',
        width: '100px',
        background: 'pink',
      }}
    />
  );
}
root.render(<App />);
