// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/preact-runtime';

function App() {
  return (
    <view className='root'>
      {Array.from({ length: 3 }).map((_, a) => (
        <view key={a} className='outer' style={{ backgroundColor: '#fa43e6' }}>
          {Array.from({ length: 16 }).map((_, b) => (
            <view
              key={b}
              className='block1'
              style={{ backgroundColor: '#cccccc' }}
            >
              {Array.from({ length: 16 }).map((_, c) => (
                <view
                  key={c}
                  className='block2'
                  style={{ backgroundColor: '#333333' }}
                >
                  {Array.from({ length: 8 }).map((_, d) => (
                    <view
                      key={d}
                      className='block3'
                      style={{ backgroundColor: 'red' }}
                    />
                  ))}
                </view>
              ))}
            </view>
          ))}
        </view>
      ))}
      <view id='stop-benchmark-true' />
    </view>
  );
}

root.render(<App />);
