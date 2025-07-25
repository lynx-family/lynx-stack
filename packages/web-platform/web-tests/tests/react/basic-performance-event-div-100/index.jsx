// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';

function App() {
  const handleTap = (e) => {
  };
  return (
    new Array(100).fill(0).map((_, i) => (
      <div
        key={i}
        id={`target-${i}`}
        bindtap={handleTap}
        style={{
          height: '100px',
          width: '100px',
          background: 'pink',
        }}
      />
    ))
  );
}

root.render(<App></App>);
