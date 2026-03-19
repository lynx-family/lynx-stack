// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  return (
    <x-input
      placeholder='foo'
      placeholder-color='red'
      placeholder-font-weight='bold'
      placeholder-font-size='20px'
      style='border: 1px solid;width: 300px;height:40px'
    />
  );
}

root.render(<App></App>);
