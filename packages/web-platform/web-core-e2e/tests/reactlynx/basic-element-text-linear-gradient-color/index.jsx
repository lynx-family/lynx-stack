// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  return (
    <view
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <text style='font-size: 30px; color: linear-gradient(green, yellow);'>
        gradient
      </text>
      <text style='font-size: 30px; '>
        <x-text style='color: linear-gradient(green, yellow);'>
          inline-gradient
        </x-text>
      </text>
      <text style='font-size: 30px; color: linear-gradient(green, yellow);'>
        <x-text>
          inline-inherit-gradient
        </x-text>
      </text>
    </view>
  );
}
root.render(<App></App>);
