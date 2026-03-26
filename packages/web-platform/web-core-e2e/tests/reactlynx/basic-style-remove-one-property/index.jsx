// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback, useState } from '@lynx-js/react';
import './index.css';
function App() {
  const [tap, setTap] = useState(true);
  const handleTap = useCallback(() => {
    setTap(!tap);
  }, [tap, setTap]);
  return (
    <view
      id='target'
      class='basic'
      bindtap={handleTap}
      style={tap
        ? { width: '100px', backgroundColor: 'green' }
        : { width: '100px' }}
    />
  );
}
root.render(<App></App>);
