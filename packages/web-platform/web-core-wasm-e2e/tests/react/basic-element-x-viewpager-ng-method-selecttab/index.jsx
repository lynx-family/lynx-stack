// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useCallback } from '@lynx-js/react';
import './index.css';
function App() {
  const handleClick = useCallback(() => {
    lynx.createSelectorQuery()
      .select('#target')
      .invoke({
        method: 'selectTab',
        params: {
          index: 1,
        },
      })
      .exec();
  }, []);
  return (
    <view class='page' bindtap={handleClick}>
      <x-viewpager-ng id='target' class='viewpager-content'>
        <x-viewpager-item-ng class='viewpager-item' style='background:red;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:green;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:blue;'>
        </x-viewpager-item-ng>
        <x-viewpager-item-ng class='viewpager-item' style='background:yellow;'>
        </x-viewpager-item-ng>
      </x-viewpager-ng>
    </view>
  );
}
root.render(<App></App>);
