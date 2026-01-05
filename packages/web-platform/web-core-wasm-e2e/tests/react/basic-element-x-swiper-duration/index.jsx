// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [current, setCurrent] = useState(0);
  const next = () => setCurrent(current + 1);

  const [duration, setDuration] = useState(200);
  const updateDurationTo100 = () => setDuration(100);

  return (
    <view class='page'>
      <x-swiper
        data-testid='swiper-1'
        duration={duration}
        current={current}
        bindtap={next}
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
        data-testid='duration-100'
        bindtap={updateDurationTo100}
      />
    </view>
  );
}

root.render(<App></App>);
