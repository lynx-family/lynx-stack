// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

lynx.evaluations = (lynx.evaluations ?? 0) + 1;
let moduleCounter = 0;
moduleCounter += 1;

function App() {
  return (
    <view
      main-thread:bindtap={() => {
        'main thread';
      }}
    >
      {lynx.__initData.hideList !== true && (
        <list>
          {[0, 1, 2].map(i => (
            <list-item item-key={`${i}`} key={i}>
              <text>{`row ${i}`}</text>
            </list-item>
          ))}
        </list>
      )}
      <text>{`evaluation ${lynx.evaluations}, module ${moduleCounter}`}</text>
    </view>
  );
}

root.render(<App />);
