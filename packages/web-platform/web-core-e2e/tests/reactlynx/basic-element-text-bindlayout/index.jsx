// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
function App() {
  const [data, setData] = useState(null);
  const bindLayout = useCallback((e) => {
    const firstLine = e.detail.lines[0];
    setData({
      lineCount: e.detail.lineCount,
      linesIsArray: Array.isArray(e.detail.lines),
      firstLineIsValid: firstLine !== undefined
        && typeof firstLine.start === 'number'
        && typeof firstLine.end === 'number'
        && typeof firstLine.ellipsisCount === 'number',
      hasTruncation: e.detail.lines.some((line) => line.ellipsisCount > 0),
    });
  }, [setData]);
  return (
    <view style='display:flex;flex-direction: column;'>
      <text
        bindlayout={bindLayout}
        id='layout-event-target'
        style='width:100px;word-break:break-all;'
        text-maxline='2'
      >
        bind-layout-a-long-long-string
      </text>
      <text id='layout-result'>
        {data
          ? `${typeof data.lineCount}:${String(data.linesIsArray)}:${
            String(data.firstLineIsValid)
          }:${String(data.hasTruncation)}`
          : 'pending'}
      </text>
      {data && <view id='created-after-layout-event' />}
    </view>
  );
}
root.render(<App></App>);
