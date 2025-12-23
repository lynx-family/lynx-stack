// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';
import './index.css';
function App() {
  const [col1, setCol1] = useState([]);
  const [col2, setCol2] = useState([]);
  useEffect(() => {
    setCol1(['red', 'green']);
    setCol2(['blue', 'yellow']);
  }, [setCol1, setCol2]);
  return (
    <view>
      <view class='rect' />
      {col1.map(color => (
        <view class='rect' id={color} style={{ backgroundColor: color }} />
      ))}
      {col2.map(color => (
        <view class='rect' id={color} style={{ backgroundColor: color }} />
      ))}
    </view>
  );
}

root.render(<App></App>);
