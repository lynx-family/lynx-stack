// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';

function App() {
  const [showLazy, setShowLazy] = useState(false);
  const [pass, setPass] = useState(false);
  useEffect(() => {
    lynx.performance.addTimingListener({
      onUpdate: (timingInfo) => {
        if (timingInfo.update_timings['__lynx_timing_actual_fmp']) {
          setShowLazy(true);
        }
        if (timingInfo.update_timings['__lynx_timing_lazy']) {
          setPass(true);
        }
      },
    });
  }, []);
  return (
    <view
      __lynx_timing_flag='__lynx_timing_actual_fmp'
      id='target'
      style={{
        height: '100px',
        width: '100px',
        background: pass ? 'green' : 'pink',
      }}
    >
      {showLazy
        && (
          <view
            __lynx_timing_flag='__lynx_timing_lazy'
            style={{
              height: '100px',
              width: '100px',
            }}
          >
          </view>
        )}
    </view>
  );
}

root.render(<App></App>);
