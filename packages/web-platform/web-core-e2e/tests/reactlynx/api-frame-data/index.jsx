// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  return (
    <view>
      <frame
        src='/dist/api-frame-inner.web.bundle'
        data={{ label: 'from-data' }}
        style={{ width: '300px', height: '120px' }}
      />
    </view>
  );
}

root.render(<App />);
