// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useMemo } from '@lynx-js/react';
function App() {
  const colors = useMemo(() => {
    return ['orange', 'wheat'];
  }, []);
  return (
    <view
      id='parent'
      style={{ display: 'flex', flexDirection: 'row', width: '180px' }}
    >
      <view
        id='pink'
        style={{ height: '100px', backgroundColor: 'pink', flex: '1 1 0' }}
      >
      </view>
      {colors.map((color) => (
        <view
          id={color}
          style={{ height: '100px', backgroundColor: color, flex: '1 1 0' }}
        >
        </view>
      ))}
    </view>
  );
}
root.render(<App />);
