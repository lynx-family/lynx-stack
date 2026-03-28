// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [placeholder, setPlaceholder] = useState('');
  const switchPlaceholder = () => {
    setPlaceholder('I am placeholder');
  };

  return (
    <view class='page'>
      <view class='block' bindtap={switchPlaceholder}></view>
      <x-textarea class='textarea' placeholder='placeholder' />
      <x-textarea class='textarea' placeholder={placeholder} />
    </view>
  );
}

root.render(<App />);
