// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view
      class='basic'
      style={{ height: '100px', width: '100px' }}
    />
  );
}
root.render(
  <page id='target'>
    <App></App>
  </page>,
);
