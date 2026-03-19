// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';

function App() {
  const [change, setChange] = useState(false);
  useEffect(() => {
    lynx.getJSModule('GlobalEventEmitter').addListener('event-test', (res) => {
      if (res === 'change') {
        setChange(true);
      }
    });
  }, []);

  return (
    <view
      id='target'
      style={{
        height: '100px',
        width: '100px',
        background: change ? 'green' : 'pink',
      }}
    />
  );
}

root.render(<App></App>);
