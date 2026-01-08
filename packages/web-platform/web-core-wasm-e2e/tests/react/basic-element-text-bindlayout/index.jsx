// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
function App() {
  const [data, setData] = useState({});
  const bindLayout = useCallback((e) => {
    setData({
      lineCount: e.detail.lineCount,
      lines: [
        {
          start: e.detail.lines[1].start,
          end: e.detail.lines[1].end,
          ellipsisCount: e.detail.lines[1].ellipsisCount,
        },
      ],
    });
  }, [setData]);
  return (
    <view style='display:flex;flex-direction: column;'>
      <view style='display:flex;flex-direction: row'>
        <text bindlayout={bindLayout}>bind-layout-a-long-long-string</text>
        <text>bind-layout-a-long-long-string</text>
        <text>bind-layout-a-long-long-string</text>
        <text>bind-layout-a-long-long-string</text>
      </view>
      <view style='display:flex;'>
        <text>{data.lineCount}</text>
        <text>{JSON.stringify(data.lines)}</text>
      </view>
    </view>
  );
}
root.render(<App></App>);
