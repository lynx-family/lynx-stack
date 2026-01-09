// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, runOnBackground } from '@lynx-js/react';
function App() {
  const [hasTouch, setHasTouch] = useState(false);
  const [hasTargetTouches, setHasTargetTouches] = useState(false);
  const [hasChangedTouches, setHasChangedTouches] = useState(false);
  return (
    <view
      id='target'
      main-thread:bindtouchstart={(ev) => {
        'main thread';
        if (ev.touches[0]) {
          runOnBackground(setHasTouch)(true);
        }
        if (ev.targetTouches[0]) {
          runOnBackground(setHasTargetTouches)(true);
        }
        if (ev.changedTouches[0]) {
          runOnBackground(setHasChangedTouches)(true);
        }
      }}
    >
      <view
        id='target1'
        style={{
          height: '100px',
          width: '100px',
          background: hasTouch ? 'green' : 'pink',
        }}
      />
      <view
        id='target2'
        style={{
          height: '100px',
          width: '100px',
          background: hasTargetTouches ? 'green' : 'pink',
        }}
      />
      <view
        id='target3'
        style={{
          height: '100px',
          width: '100px',
          background: hasChangedTouches ? 'green' : 'pink',
        }}
      />
    </view>
  );
}
root.render(<App />);
