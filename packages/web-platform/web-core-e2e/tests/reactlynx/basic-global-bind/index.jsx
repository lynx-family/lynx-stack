// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function App() {
  const [color, setColor] = useState('pink');
  return (
    <view>
      {
        /*
        This is the target element.
        When clicking here, the 'tap' event bubbles and should trigger 'global-bindtap'.
      */
      }
      <view
        id='target'
        style={{
          height: '100px',
          width: '100px',
          background: 'blue',
        }}
      />
      {
        /*
        This is the observer element observing 'global-bindtap'.
      */
      }
      <view
        id='observer'
        global-bindTap={() => setColor(color === 'pink' ? 'green' : 'pink')}
        style={{
          height: '100px',
          width: '100px',
          background: color,
        }}
      />
    </view>
  );
}

root.render(<App />);
