// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  return (
    <view
      id='target'
      style={{
        height: '100px',
        width: '100px',
        background: globalThis.Object ? 'green' : 'pink',
      }}
    />
  );
}

root.render(<App></App>);
