// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
function App() {
  const handleTap = () => {
    lynx.getElementById('target').animate(
      [
        { transform: 'translateX(0px)' }, // Initial state
        { transform: 'translateX(100px)' }, // Final state
      ],
      {
        duration: 1000,
        iterations: 1,
        fill: 'forwards',
      },
    );
  };

  return (
    <view
      id='target'
      style='width: 300px; height: 300px; background-color: green'
      bindtap={handleTap}
    />
  );
}
root.render(
  <page>
    <App></App>
  </page>,
);
