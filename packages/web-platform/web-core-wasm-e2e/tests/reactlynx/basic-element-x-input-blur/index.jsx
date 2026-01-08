// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const value = 'bindblur';
  const [result, setResult] = useState();

  const handleClick = () => {
    lynx.createSelectorQuery()
      .select('.input')
      .invoke({
        method: 'blur',
      })
      .exec();
  };

  const onBlur = ({ detail: { value } }) => {
    setResult(value);
  };

  return (
    <view>
      <view
        class='blur'
        bindtap={handleClick}
        style='width:100px;height:100px;background-color:red'
      >
      </view>
      <x-input
        class='input'
        bindblur={onBlur}
        focus
        value={value}
        style='border: 1px solid;width: 80vw;height:40px'
      />
      <view class='result'>
        <text>{result}</text>
      </view>
    </view>
  );
}

root.render(<App></App>);
