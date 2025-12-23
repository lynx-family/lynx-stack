// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [current, setCurrent] = useState(0);
  const next = () => setCurrent(current + 1);

  return (
    <view class='page'>
      <x-swiper
        data-testid='normal'
        current={current}
        page-margin='20rpx'
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
        data-testid='carousel'
        current={current}
        mode='carousel'
        page-margin='20rpx'
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
        data-testid='carry'
        current={current}
        mode='carry'
        page-margin='20rpx'
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
        data-testid='coverflow'
        current={current}
        mode='coverflow'
        page-margin='20rpx'
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
        data-testid='flat-coverflow'
        current={current}
        mode='flat-coverflow'
        page-margin='20rpx'
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
    </view>
  );
}

root.render(<App></App>);
