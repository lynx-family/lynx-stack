// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';

function App() {
  const [color, setColor] = useState('pink');
  useEffect(() => {
    NativeModules.bridge.call('getColor', { color: 'green' }, (color) => {
      setColor(color);
    });
  }, []);
  return (
    <view
      id='target'
      style={{
        height: '100px',
        width: '100px',
        background: color,
      }}
    />
  );
}

root.render(<App></App>);
