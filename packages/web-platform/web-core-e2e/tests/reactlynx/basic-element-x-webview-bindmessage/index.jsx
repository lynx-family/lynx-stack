// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

function App() {
  const [message, setMessage] = useState('waiting');

  return (
    <view>
      <x-webview
        html={`<script>
          window.parent.postMessage(
            { type: 'greeting', text: 'hello from iframe' },
            '*',
          );
        </script>`}
        bindmessage={event => setMessage(event.detail.msg.text)}
        style={{ width: '300px', height: '120px' }}
      />
      <text id='webview-message'>{message}</text>
    </view>
  );
}

root.render(<App />);
