// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [interval, setInterval] = useState(5000);
  const switchIntervalTo1000 = () => setInterval(1000);
  const switchIntervalTo0 = () => setInterval(0);

  return (
    <view class='page'>
      <x-swiper
        autoplay
        interval={interval}
      >
        <x-swiper-item style={{ backgroundColor: 'red' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'green' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'blue' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'yellow' }}>
        </x-swiper-item>
      </x-swiper>

      <view
        class='btn'
        data-testid='interval-1000'
        bindtap={switchIntervalTo1000}
      />
      <view class='btn' data-testid='interval-0' bindtap={switchIntervalTo0} />
    </view>
  );
}

root.render(<App></App>);
