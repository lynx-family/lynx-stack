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
  270,
  203,
  203,
  339,
  291,
  165,
  267,
  281,
  294,
  239,
  173,
  185,
  220,
  180,
];

function App() {
  return (
    <view class='page'>
      <list list-type='waterfall' span-count='2' className='list'>
        {data.map((i, idx) => (
          <list-item
            item-key={idx}
            class='item'
            style={{ '--item-index': idx, height: `${i}px` }}
          />
        ))}
      </list>
    </view>
  );
}

root.render(<App></App>);
