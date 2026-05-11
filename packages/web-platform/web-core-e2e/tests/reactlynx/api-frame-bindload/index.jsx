// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [detail, setDetail] = useState({
    statusCode: -1,
    statusMessage: '',
    url: '',
  });

  return (
    <view>
      <frame
        src='/dist/api-frame-inner.web.bundle'
        bindload={event => setDetail(event.detail)}
        style={{ width: '300px', height: '120px' }}
      />
      <text id='frame-load-status'>{detail.statusCode}</text>
      <text id='frame-load-message'>{detail.statusMessage}</text>
      <text id='frame-load-url'>{detail.url}</text>
    </view>
  );
}

root.render(<App />);
