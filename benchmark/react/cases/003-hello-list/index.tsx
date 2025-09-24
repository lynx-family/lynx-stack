// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { memo, root, useEffect, useRef, useState } from '@lynx-js/react';
import type { NodesRef } from '@lynx-js/types';

import RecursiveText from '../002-hello-reactLynx/RecursiveText.js';

const MemoedRecursiveText = /* @__PURE__ */ memo(RecursiveText);

function BenchmarkList() {
  const [stopBenchmark, setStopBenchmark] = useState(false);
  const listRef = useRef<NodesRef>(null);
  useEffect(() => {
    listRef.current!.invoke({
      method: 'scrollToPosition',
      params: {
        position: 1,
        smooth: false,
      },
      success: function() {
        listRef.current!.invoke({
          method: 'scrollToPosition',
          params: {
            position: 2,
            smooth: false,
          },
          success: function() {
            setStopBenchmark(true);
          },
        }).exec();
      },
    }).exec();
  }, []);

  return (
    <list
      custom-list-name={'list-container'}
      style={{
        height: '100rpx',
        width: '500rpx',
        backgroundColor: 'red',
      }}
      ref={listRef}
      id={`stop-benchmark-${stopBenchmark}`}
    >
      {Array.from(
        { length: 5 },
        (_, index) => (
          <list-item
            item-key={`${index}`}
            style={{
              height: '48rpx',
              width: '400rpx',
              backgroundColor: 'blue',
            }}
          >
            <text style={{ color: `hsl(${index * 36}, 100%, 50%)` }}>
              <MemoedRecursiveText
                text={`Hello, ReactLynx 🎉! Index: ${index}`}
              />
            </text>
          </list-item>
        ),
      )}
    </list>
  );
}

runAfterLoadScript(() => {
  root.render(
    <BenchmarkList />,
  );
});
