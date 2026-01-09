// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useMemo } from '@lynx-js/react';
function App() {
  const colors = useMemo(() => {
    return ['pink', 'orange', 'wheat'];
  }, []);
  return (
    <view>
      <view></view>
      {colors.map((color) => (
        <view
          id={color}
          style={{ height: '100px', width: '100px', backgroundColor: color }}
        >
        </view>
      ))}
    </view>
  );
}
root.render(<App />);
