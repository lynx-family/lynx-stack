// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';
import './index.css';

function App() {
  const [disabled, setDisabled] = useState(false);
  const switchDisabled = () => {
    setDisabled(!disabled);
  };

  return (
    <view class='page'>
      <view class='block' bindtap={switchDisabled}></view>
      <x-textarea class='textarea' />
      <x-textarea class='textarea' disabled />
      <x-textarea class='textarea' disabled={disabled} />
    </view>
  );
}

root.render(<App />);
