// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import './index.css';

function App() {
  const [autoplay, setAutoplay] = useState(false);

  const switchAutoPlay = () => setAutoplay(!autoplay);

  return (
    <view class='page'>
      <x-swiper autoplay={autoplay}>
        <x-swiper-item style={{ backgroundColor: 'red' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'green' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'blue' }}>
        </x-swiper-item>
        <x-swiper-item style={{ backgroundColor: 'yellow' }}>
        </x-swiper-item>
      </x-swiper>

      <view class='btn' data-testid='autoplay' bindtap={switchAutoPlay} />
    </view>
  );
}

root.render(<App></App>);
