// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [focus, setFocus] = useState(false);
  const switchFocus = () => {
    setFocus(!focus);
  };

  return (
    <view class='page'>
      <view class='block' bindtap={switchFocus}></view>
      <x-textarea class='textarea' />
      <x-textarea class='textarea' focus />
      <x-textarea class='textarea' focus={focus} />
    </view>
  );
}

root.render(<App />);
