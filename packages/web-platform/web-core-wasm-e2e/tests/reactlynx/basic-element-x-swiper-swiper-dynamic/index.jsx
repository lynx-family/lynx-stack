// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState } from '@lynx-js/react';

import { getColor } from './getColor';
import './index.css';

function App() {
  const [val, setVal] = useState(0);
  const valAdd1 = () => setVal(val + 1);

  const [current, setCurrent] = useState(0);
  const next = () => setCurrent(current + 1);

  return (
    <view class='page'>
      <x-swiper
        data-testid='swiper-0'
        current={1}
        bindtap={valAdd1}
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

      {val % 2 === 0
        ? (
          <x-swiper
            data-testid='swiper-1'
            indicator-color={getColor(current)}
            current={current}
            bindtap={next}
          >
            <x-swiper-item>
              <text>index-0</text>
            </x-swiper-item>
            <x-swiper-item>
              <text>index-1</text>
            </x-swiper-item>
            <x-swiper-item>
              <text>index-2</text>
            </x-swiper-item>
            <x-swiper-item>
              <text>index-3</text>
            </x-swiper-item>
          </x-swiper>
        )
        : null}
    </view>
  );
}

root.render(<App></App>);
