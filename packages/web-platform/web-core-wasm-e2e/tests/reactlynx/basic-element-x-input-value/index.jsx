// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [value, setValue] = useState('');

  const handleClick = () => {
    setValue(value + '1');
  };

  return (
    <view>
      <view
        class='click'
        bindtap={handleClick}
        style='width:100px;height:100px;background-color:red'
      >
      </view>
      <x-input
        class='input'
        value={value}
        style='border: 1px solid;width: 300px;height:40px'
      />
      <view class='result'>
        <text>{value}</text>
      </view>
    </view>
  );
}

root.render(<App></App>);
