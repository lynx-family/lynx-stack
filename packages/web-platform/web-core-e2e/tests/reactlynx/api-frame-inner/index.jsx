// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useInitData } from '@lynx-js/react';

function App() {
  const initData = useInitData();
  const globalProps = lynx.__globalProps;

  return (
    <view>
      <text id='frame-ready'>frame:ready</text>
      <text id='frame-data'>data:{initData.label}</text>
      <text id='frame-global-props'>global:{globalProps.message}</text>
    </view>
  );
}

root.render(<App />);
