// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { root } from '@lynx-js/react';

import { RunBenchmarkUntilHydrate } from '../../src/RunBenchmarkUntil.js';

import './index.css';

function App() {
  return (
    <view className='root'>
      {(Array.from({ length: 3 }).fill(1)).map(() => (
        <view className='outer' style={{ backgroundColor: '#fa43e6' }}>
          {(Array.from({ length: 16 }).fill(1)).map(() => (
            <view className='block1' style={{ backgroundColor: '#cccccc' }}>
              {(Array.from({ length: 16 }).fill(1)).map(() => (
                <view className='block2' style={{ backgroundColor: '#333333' }}>
                  {(Array.from({ length: 8 }).fill(1)).map(() => (
                    <view className='block3' style={{ backgroundColor: 'red' }}>
                    </view>
                  ))}
                </view>
              ))}
            </view>
          ))}
        </view>
      ))}
    </view>
  );
}
runAfterLoadScript(() => {
  root.render(
    <>
      <App />
      <RunBenchmarkUntilHydrate />
    </>,
  );
});
