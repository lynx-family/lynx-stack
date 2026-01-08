// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [value, setVal] = useState('ccc\naa\nbbb\na');
  const setValue = () => {
    setVal('a\naa\nbbb\nccc');
  };

  return (
    <scroll-view class='page'>
      <view class='block' data-testid='setValue' bindtap={setValue}></view>
      <x-textarea
        data-testid='textarea'
        class='textarea'
        maxlines={3}
        value={value}
      />
    </scroll-view>
  );
}

root.render(<App />);
