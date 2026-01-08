// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';
import './index.css';
function App() {
  const [test, setTest] = useState('');
  useEffect(() => {
    setTimeout(() => {
      setTest('123456');
    }, 1000);
  }, [setTest]);
  return (
    <view class='countdown'>
      <text text-maxlength='5'>{test}</text>
    </view>
  );
}
root.render(<App></App>);
