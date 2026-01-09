// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useMemo } from '@lynx-js/react';
import './index.css';
function App() {
  const colors = useMemo(() => {
    return ['pink', 'orange', 'wheat'];
  }, []);
  return (
    <view style='width:auto; height:auto;'>
      <view class='background-green'></view>
      <view class='background-yellow'></view>
    </view>
  );
}
root.render(<App />);
