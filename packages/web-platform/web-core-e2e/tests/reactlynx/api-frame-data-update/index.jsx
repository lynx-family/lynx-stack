// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [label, setLabel] = useState('before');

  return (
    <view>
      <frame
        src='/dist/api-frame-inner.web.bundle'
        data={{ label }}
        style={{ width: '300px', height: '120px' }}
      />
      <view id='update-frame-data' bindtap={() => setLabel('after')}>
        <text>update</text>
      </view>
    </view>
  );
}

root.render(<App />);
