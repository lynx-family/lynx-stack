// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  return (
    <view>
      <x-input value='foo' style='border: 1px solid;width: 300px;height:40px' />
      <x-input
        type='text'
        value='foo'
        style='border: 1px solid;width: 300px;height:40px'
      />
      <x-input
        type='number'
        value='123'
        style='border: 1px solid;width: 300px;height:40px'
      />
      <x-input
        type='digit'
        value='456'
        style='border: 1px solid;width: 300px;height:40px'
      />
      <x-input
        type='password'
        value='foo'
        style='border: 1px solid;width: 300px;height:40px'
      />
      <x-input
        type='tel'
        value='12344545643'
        style='border: 1px solid;width: 300px;height:40px'
      />
      <x-input
        type='email'
        value='foo@example.com'
        style='border: 1px solid;width: 300px;height:40px'
      />
    </view>
  );
}

root.render(<App></App>);
