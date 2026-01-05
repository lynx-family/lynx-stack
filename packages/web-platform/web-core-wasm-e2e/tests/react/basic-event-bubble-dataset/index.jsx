// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';

function App() {
  const [valA, setColor0] = useState('pink');
  const [objA, setColor1] = useState('pink');
  const tapHandler = useCallback((event) => {
    if (event.target.dataset['val-a'] === 'valA') {
      setColor0('green');
    }
    if (event.target.dataset['obj-a'].val === 'obj') {
      setColor1('green');
    }
  }, []);
  return (
    <view
      id='result'
      bindtap={tapHandler}
    >
      <view
        id='target'
        style={{ height: '50px', width: '50px' }}
        data-val-a='valA'
        data-obj-a={{ val: 'obj' }}
      >
      </view>
      <view
        id='val-a'
        style={{
          height: '100px',
          width: '100px',
          background: valA,
        }}
      />
      <view
        id='obj-a'
        style={{
          height: '100px',
          width: '100px',
          background: objA,
        }}
      />
    </view>
  );
}

root.render(<App></App>);
