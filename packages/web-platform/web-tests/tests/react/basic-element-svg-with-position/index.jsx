// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view style={{ width: '500px', height: '500px' }}>
      <svg
        content={`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 100 100" enable-background="new 0 0 100 100" xml:space="preserve" height="100px" width="100px">
        <rect width="100" height="100" fill="red" />
      </svg>`}
        class='basketball'
      >
      </svg>
    </view>
  );
}
root.render(<App></App>);
