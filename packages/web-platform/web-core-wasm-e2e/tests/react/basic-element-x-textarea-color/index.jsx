// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root } from '@lynx-js/react';

function App() {
  return (
    <x-textarea
      style={{
        width: '100%',
        height: '100px',
        color: 'red',
      }}
      value='111'
    />
  );
}

root.render(<App />);
