// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
import './index.css';
function App() {
  const [data, setData] = useState({
    class_1: 'normal-text',
    class_2: 'active-text',
    style_1: 'color: skyblue;',
    style_2: 'font-size: 32px;',
  });
  const updateStyle = useCallback(() => {
    setData({
      class_1: 'active-text',
      class_2: 'normal-text',
      style_1: 'font-size: 32px;',
      style_2: 'color: skyblue;',
    });
  }, [setData]);
  return (
    <view style='display:flex;'>
      <text class={data.class_1}>text-grp-1</text>
      <text class={data.class_2}>text-grp-2</text>

      <text style={data.style_1}>text-grp-3</text>
      <text style={data.style_2}>text-grp-4</text>

      <view data-testid='updateStyle' class='btn' bindtap={updateStyle} />
    </view>
  );
}
root.render(<App></App>);
