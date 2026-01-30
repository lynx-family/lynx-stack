// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState, useEffect } from '@lynx-js/react';
import './index.css';

function App() {
  const [loading, setLoading] = useState(true);
  const handleTap = () => setLoading(!loading);

  return (
    <view class='page'>
      <view
        id='target'
        style={{ width: '100px', height: '100px', backgroundColor: 'blue' }}
        bindtap={handleTap}
      >
      </view>
      <list list-type='single'>
        <list-item
          item-key='1'
          id='1'
          style={{ backgroundColor: 'pink' }}
        >
        </list-item>
        {loading
          ? (
            <>
              <list-item
                item-key='2'
                id='2'
                style={{ backgroundColor: 'orange' }}
              >
              </list-item>
              <list-item
                item-key='3'
                id='3'
                style={{ backgroundColor: 'black' }}
              >
              </list-item>
            </>
          )
          : (
            <>
              <list-item
                item-key='4'
                id='4'
                style={{ backgroundColor: 'red' }}
              >
              </list-item>
            </>
          )}
        <list-item
          item-key='5'
          id='5'
          style={{ backgroundColor: 'yellow' }}
        >
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);
