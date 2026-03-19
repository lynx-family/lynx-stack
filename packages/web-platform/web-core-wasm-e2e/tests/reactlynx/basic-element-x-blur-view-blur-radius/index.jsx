// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import Image from '../../../resources/firefox-logo.png';
import './index.css';
function App() {
  return (
    <view
      class='outer-view'
      style={{
        backgroundImage: `url(${Image})`,
      }}
    >
      <x-blur-view
        style='width: 100%; height: 100px; margin-top: 50px; border: 1px solid red; padding: 10px;'
        blur-radius='25px'
      >
        <text class='text'>
          blur-radius 25
        </text>
      </x-blur-view>
    </view>
  );
}
root.render(<App></App>);
