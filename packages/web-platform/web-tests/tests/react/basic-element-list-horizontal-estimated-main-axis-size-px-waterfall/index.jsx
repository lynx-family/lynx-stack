// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useRef, useState, useEffect } from '@lynx-js/react';
import './index.css';

const data = [
  185,
  295,
  172,
  335,
  277,
];

function App() {
  const ref = useRef(null);

  const handleScrollToLower = (e) => {
    console.log(e);
  };

  useEffect(() => {
    ref.current
      ?.invoke({
        method: 'autoScroll',
        params: {
          rate: '100',
          start: true,
        },
      })
      .exec();
  }, []);

  return (
    <view class='page'>
      <list
        list-type='waterfall'
        scroll-orientation='horizontal'
        span-count='2'
        className='list'
        bindscrolltolower={handleScrollToLower}
        ref={ref}
      >
        {data.map((i, idx) => (
          <list-item
            item-key={idx}
            class='item'
            style={{ '--item-index': idx }}
            estimated-main-axis-size-px={i}
          />
        ))}
      </list>
    </view>
  );
}

root.render(<App></App>);
