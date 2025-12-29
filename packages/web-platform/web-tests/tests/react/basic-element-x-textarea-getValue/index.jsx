// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  const handleClick = () => {
    lynx.createSelectorQuery()
      .select('.input')
      .invoke({
        method: 'getValue',
        success: function(res) {
          console.log(res);
        },
        fail: function(res) {
          console.log(res);
        },
      })
      .exec();
  };

  return (
    <view>
      <view
        id='target'
        bindtap={handleClick}
        style='width:100px;height:100px;background-color:red'
      >
      </view>
      <x-textarea
        class='input'
        value='hello'
        style='border: 1px solid;width: 300px;height:40px'
      />
    </view>
  );
}

root.render(<App></App>);
