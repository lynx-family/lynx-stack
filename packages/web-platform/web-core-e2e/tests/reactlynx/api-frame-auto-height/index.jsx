// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  return (
    <view>
      <frame
        id='target'
        auto-height={true}
        src='/dist/api-frame-inner.web.bundle'
        style={{ width: '300px' }}
      />
    </view>
  );
}

root.render(<App />);
