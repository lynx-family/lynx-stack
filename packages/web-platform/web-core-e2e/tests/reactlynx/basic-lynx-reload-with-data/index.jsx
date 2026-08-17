// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useInitData } from '@lynx-js/react';
function App() {
  const initData = useInitData();
  return (
    <view
      id='target'
      bindTap={() => {
        lynx.reload({ mockData: 'reloaded' }, () => {
          console.log('reload callback fired');
        });
      }}
      style={{
        height: '100px',
        width: '100px',
        background: initData?.mockData === 'reloaded' ? 'green' : 'pink',
      }}
    />
  );
}
root.render(<App />);
