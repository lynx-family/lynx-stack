// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [status, setStatus] = useState('');
  const [current, setCurrent] = useState(0);
  const next = () => setCurrent((current + 1) % 4);

  const bindChange = (e) => {
    console.log(e);
  };

  return (
    <view class='page'>
      <x-swiper
        data-testid='manual'
        bindscrollend={bindChange}
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

      <x-swiper
        data-testid='autoplay'
        interval={1000}
        autoplay
        bindscrollend={bindChange}
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

      <x-swiper
        data-testid='programming'
        circular
        bindscrollend={bindChange}
        current={current}
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

      <view class='btn' data-testid='next' bindtap={next} />

      <view>
        <text>{status}</text>
      </view>
    </view>
  );
}

root.render(<App></App>);
