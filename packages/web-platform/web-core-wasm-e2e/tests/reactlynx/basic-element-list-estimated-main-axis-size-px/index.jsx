// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useRef } from '@lynx-js/react';
import './index.css';

function App() {
  const ref = useRef(null);

  return (
    <view class='page'>
      <list
        list-type='single'
        ref={ref}
      >
        <list-item style={{ '--item-index': 1, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 2, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 3, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 4, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 5, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 6, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 7, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 8, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 9, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 10, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 11, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 12, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 13, height: '300px' }}></list-item>
        <list-item style={{ '--item-index': 14, height: '300px' }}></list-item>
        <list-item
          style={{ '--item-index': 15 }}
          estimated-main-axis-size-px={100}
          id='target'
        >
          <view style={{ height: '200px' }}></view>
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);
