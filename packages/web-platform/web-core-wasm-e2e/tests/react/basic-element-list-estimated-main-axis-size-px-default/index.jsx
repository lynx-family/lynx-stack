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
        <list-item item-key='1' id='1' style={{ '--item-index': 1 }}>
        </list-item>
        <list-item item-key='2' id='2' style={{ '--item-index': 2 }}>
        </list-item>
        <list-item item-key='3' id='3' style={{ '--item-index': 3 }}>
        </list-item>
        <list-item item-key='4' id='4' style={{ '--item-index': 4 }}>
        </list-item>
        <list-item item-key='5' id='5' style={{ '--item-index': 5 }}>
        </list-item>
        <list-item item-key='6' id='6' style={{ '--item-index': 6 }}>
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);
