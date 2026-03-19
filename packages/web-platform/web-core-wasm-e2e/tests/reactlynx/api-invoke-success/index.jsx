// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

export function App() {
  const [success, setSuccess] = useState(false);

  const invokeFocus = () => {
    lynx.createSelectorQuery().select('#input').invoke({
      method: 'focus',
      success: function() {
        setSuccess(true);
      },
      fail: function() {},
    }).exec();
  };

  return (
    <view>
      <x-input id='input' style='border: 1px solid;width: 80vw;height:40px' />
      <view
        bindtap={invokeFocus}
        id='target'
        style={{
          width: '10px',
          height: '10px',
          background: 'blue',
        }}
      >
      </view>
      <view
        style={{
          width: '200px',
          height: '200px',
          background: success ? 'green' : 'pink',
        }}
        id='result'
      >
      </view>
    </view>
  );
}

root.render(<App></App>);
