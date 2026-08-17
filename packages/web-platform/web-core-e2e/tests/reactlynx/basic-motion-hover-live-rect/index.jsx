// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { motion } from '@lynx-js/motion';
import { root, useState } from '@lynx-js/react';

function App() {
  const [shifted, setShifted] = useState(false);
  return (
    <view>
      <scroll-view
        id='scroller'
        scroll-y
        style={{ width: '240px', height: '180px', backgroundColor: '#eeeeee' }}
      >
        <view style={{ height: '100px' }} />
        <motion.view
          id='scroll-target'
          style={{ width: '120px', height: '80px', backgroundColor: '#ff0000' }}
          whileHover={{ backgroundColor: '#00ff00' }}
          transition={{ duration: 0 }}
        />
        <view style={{ height: '300px' }} />
      </scroll-view>
      <view
        id='shift-control'
        style={{ width: '100px', height: '40px' }}
        bindtap={() => setShifted(value => !value)}
      />
      <motion.view
        id='shift-target'
        style={{
          position: 'relative',
          left: shifted ? '180px' : '0px',
          width: '120px',
          height: '80px',
          backgroundColor: '#ff0000',
        }}
        whileHover={{ backgroundColor: '#00ff00' }}
        transition={{ duration: 0 }}
      />
    </view>
  );
}

root.render(<App />);
