// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState, useEffect } from '@lynx-js/react';

export default function App() {
  const [color, setColor] = useState('green');
  useEffect(() => {
    setColor('pink');
  }, []);

  return (
    <view
      style={{ width: '200px', height: '200px', backgroundColor: color }}
      id='target'
    >
    </view>
  );
}
