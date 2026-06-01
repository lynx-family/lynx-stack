// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

function App() {
  return (
    <view
      style={{
        backgroundColor: 'white',
        display: 'linear',
        height: '100vh',
        padding: '24px',
        width: '100vw',
      }}
    >
      <text
        style={{
          color: '#111111',
          fontFamily: '"Press Start 2P E2E"',
          fontSize: '18px',
          lineHeight: '30px',
        }}
      >
        EXTRA FONT 0123
      </text>
      <text
        style={{
          color: '#0066cc',
          fontFamily: '"Press Start 2P E2E"',
          fontSize: '14px',
          lineHeight: '28px',
          marginTop: '20px',
        }}
      >
        SHADOW ROOT HOST
      </text>
    </view>
  );
}

root.render(<App />);
