// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';
import { useEffect } from 'react';

export function App() {
  const [match, setMatch] = useState(false);

  // The expected path from the target node up to the root (in reverse order)
  // We'll check tag, id, and index for each node in the path
  const expectedPath = [
    { tag: 'text', id: 'target', index: 0 },
    { tag: 'view', id: 'inner', index: 1 },
    { tag: 'view', id: 'middle', index: 0 },
    { tag: 'view', id: 'outer', index: 0 },
    { tag: 'view', index: 0 },
    { tag: 'page', index: 0 },
  ];

  useEffect(() => {
    lynx.createSelectorQuery().select('#target').path((res, status) => {
      try {
        const pathArr = res.path;
        // Only check the top N nodes (from leaf to root)
        let isMatch = true;
        for (let i = 0; i < expectedPath.length; i++) {
          const node = pathArr[i];
          const expect = expectedPath[i];
          if (
            !node || node.tag !== expect.tag || node.id !== expect.id
            || node.index !== expect.index
          ) {
            isMatch = false;
            break;
          }
        }
        setMatch(isMatch);
      } catch (e) {
        setMatch(false);
      }
    }).exec();
  }, []);

  return (
    <view>
      <view id='outer'>
        <view id='middle'>
          <view></view>
          <view id='inner'>
            <text id='target' />
          </view>
        </view>
      </view>
      <view
        style={{
          width: '400px',
          height: '200px',
          background: match ? 'green' : 'pink',
          wordBreak: 'break-all',
        }}
        id='result'
      >
      </view>
    </view>
  );
}

root.render(<App></App>);
